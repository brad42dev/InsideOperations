//! SVG tile pyramid generation.
//!
//! Tiles are stored as PNG files at:
//!   {storage_dir}/graphics/{graphic_id}/z{zoom}/r{row}_c{col}.png
//!
//! Zoom 0 = entire graphic in one tile (scaled to tile_size × tile_size)
//! Zoom N = 2^N × 2^N grid of tiles covering the full graphic at higher resolution.

use resvg::render;
use resvg::usvg::{Options, Tree};
use std::path::PathBuf;
use tiny_skia::{Pixmap, Transform};

// ---------------------------------------------------------------------------
// Public config type
// ---------------------------------------------------------------------------

pub struct TileConfig {
    pub storage_dir: String,
    pub max_zoom: u8,
    pub tile_size: u32,
}

// ---------------------------------------------------------------------------
// generate_tiles
// ---------------------------------------------------------------------------

/// Generate a full tile pyramid for a graphic from its SVG source.
///
/// Returns `(total_tiles_generated, svg_width_px, svg_height_px)`.
pub fn generate_tiles(
    svg_data: &str,
    graphic_id: &str,
    config: &TileConfig,
) -> Result<(usize, u32, u32), String> {
    let opt = Options::default();
    let tree = Tree::from_str(svg_data, &opt).map_err(|e| format!("SVG parse error: {e}"))?;

    let svg_size = tree.size();
    let svg_w = svg_size.width() as u32;
    let svg_h = svg_size.height() as u32;

    let base_dir = PathBuf::from(&config.storage_dir)
        .join("graphics")
        .join(graphic_id);

    std::fs::create_dir_all(&base_dir).map_err(|e| format!("mkdir failed: {e}"))?;

    let mut total = 0usize;

    for zoom in 0..=config.max_zoom {
        let cols = 1u32 << zoom; // 2^zoom
        let rows = 1u32 << zoom;

        let zoom_dir = base_dir.join(format!("z{zoom}"));
        std::fs::create_dir_all(&zoom_dir).map_err(|e| format!("mkdir zoom dir: {e}"))?;

        // Scale the entire SVG to fill (cols × tile_size) × (rows × tile_size)
        let target_w = cols * config.tile_size;
        let target_h = rows * config.tile_size;
        let scale_x = target_w as f32 / svg_w.max(1) as f32;
        let scale_y = target_h as f32 / svg_h.max(1) as f32;

        // Render the full scaled image into a single pixmap
        let mut full_pixmap = Pixmap::new(target_w, target_h)
            .ok_or_else(|| format!("Failed to allocate pixmap ({target_w}×{target_h})"))?;

        let transform = Transform::from_scale(scale_x, scale_y);
        render(&tree, transform, &mut full_pixmap.as_mut());

        // Slice the full pixmap into individual tiles
        for row in 0..rows {
            for col in 0..cols {
                let x = col * config.tile_size;
                let y = row * config.tile_size;

                let mut tile = Pixmap::new(config.tile_size, config.tile_size)
                    .ok_or("Failed to allocate tile pixmap")?;

                let src_data = full_pixmap.data();
                let dst_data = tile.data_mut();
                let stride = target_w as usize * 4; // RGBA bytes per row

                for ty in 0..config.tile_size as usize {
                    let src_row_start = ((y as usize + ty) * stride) + (x as usize * 4);
                    let dst_row_start = ty * config.tile_size as usize * 4;
                    let len = config.tile_size as usize * 4;
                    if src_row_start + len <= src_data.len() {
                        dst_data[dst_row_start..dst_row_start + len]
                            .copy_from_slice(&src_data[src_row_start..src_row_start + len]);
                    }
                }

                let tile_path = zoom_dir.join(format!("r{row}_c{col}.png"));
                tile.save_png(&tile_path)
                    .map_err(|e| format!("PNG save error: {e}"))?;
                total += 1;
            }
        }
    }

    Ok((total, svg_w, svg_h))
}

// ---------------------------------------------------------------------------
// delete_tiles
// ---------------------------------------------------------------------------

/// Remove all tiles for a graphic (call on delete or overwrite).
pub fn delete_tiles(graphic_id: &str, storage_dir: &str) -> std::io::Result<()> {
    let path = PathBuf::from(storage_dir).join("graphics").join(graphic_id);
    if path.exists() {
        std::fs::remove_dir_all(path)?;
    }
    Ok(())
}
