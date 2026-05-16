import { VersionRecoveryDialog } from "../../../shared/components/versioning/VersionRecoveryDialog";
import type { GraphicDocument } from "../../../shared/types/graphics";
import type { GraphicVersionContent } from "../../../shared/types/versioning";

interface VersionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  graphicId: string | null;
  onPreview: (versionId: string, doc: GraphicDocument) => void;
  onRestore: (versionId: string) => void;
}

export default function VersionHistoryDialog({
  open,
  onClose,
  graphicId,
  onPreview,
  onRestore,
}: VersionHistoryDialogProps) {
  if (!graphicId) return null;

  return (
    <VersionRecoveryDialog
      open={open}
      onClose={onClose}
      objectType="graphic"
      objectId={graphicId}
      onLoadVersion={(content) => {
        const gc = content as GraphicVersionContent;
        const versionId = String(gc.version_number);
        onPreview(versionId, gc.scene_data as GraphicDocument);
        onRestore(versionId);
      }}
    />
  );
}
