/// Criterion benchmarks for io-models serialization hot paths.
///
/// Measures serde_json encode/decode throughput for `PointValue`, which is
/// the highest-frequency payload on the Data Broker WebSocket path.
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use io_models::point::{PointQuality, PointValue};
use uuid::Uuid;

fn make_point_value() -> PointValue {
    PointValue {
        point_id: Uuid::new_v4(),
        value: 42.5,
        quality: PointQuality::Good,
        timestamp: chrono::Utc::now(),
    }
}

fn bench_point_value_serialize(c: &mut Criterion) {
    let pv = make_point_value();
    c.bench_function("point_value_serialize", |b| {
        b.iter(|| {
            let json = serde_json::to_string(black_box(&pv)).expect("serialize");
            black_box(json);
        });
    });
}

fn bench_point_value_deserialize(c: &mut Criterion) {
    let pv = make_point_value();
    let json = serde_json::to_string(&pv).expect("serialize for bench");
    c.bench_function("point_value_deserialize", |b| {
        b.iter(|| {
            let result: PointValue =
                serde_json::from_str(black_box(&json)).expect("deserialize");
            black_box(result);
        });
    });
}

fn bench_point_value_batch_serialize(c: &mut Criterion) {
    let batch: Vec<PointValue> = (0..100).map(|_| make_point_value()).collect();
    c.bench_function("point_value_batch_100_serialize", |b| {
        b.iter(|| {
            let json = serde_json::to_string(black_box(&batch)).expect("serialize");
            black_box(json);
        });
    });
}

criterion_group!(
    benches,
    bench_point_value_serialize,
    bench_point_value_deserialize,
    bench_point_value_batch_serialize
);
criterion_main!(benches);
