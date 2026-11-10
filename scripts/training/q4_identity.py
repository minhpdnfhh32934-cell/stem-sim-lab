"""Identity test for "keep the app's graph, swap the weights".

Recomputes every 4-bit weight of the published Gemma 4 E2B decoder from the official PyTorch
weights and compares it with the published bytes. If they match, the name map, the matrix layout
and the quantizer are right, so a trained model's weights can be written the same way.
"""
import collections, json, re, sys, time

import numpy as np
import onnx
from safetensors import safe_open

from q4_weights import compute, sources

sys.stdout.reconfigure(encoding="utf-8")
# usage: q4_identity.py <folder with decoder_model_merged_q4.onnx + .onnx_data> <model.safetensors>
REF = sys.argv[1].rstrip("/\\") + "/"
DATA = REF + "decoder_model_merged_q4.onnx_data"
PT = sys.argv[2]

m = onnx.load(REF + "decoder_model_merged_q4.onnx", load_external_data=False)
init = {t.name: t for t in m.graph.initializer}
data_file = open(DATA, "rb")


def stored(t, dtype):
    if t.data_location == onnx.TensorProto.EXTERNAL:
        ext = {e.key: e.value for e in t.external_data}
        data_file.seek(int(ext.get("offset", 0)))
        return np.frombuffer(data_file.read(int(ext["length"])), dtype=dtype)
    return np.frombuffer(t.raw_data, dtype=dtype)


nodes = [n for n in m.graph.node if n.op_type == "MatMulNBits"]
res = collections.defaultdict(lambda: {"n": 0, "identical": 0, "bytes_equal": 0.0, "scale_err": 0.0})
skipped, examples = [], []
start = time.time()
with safe_open(PT, "pt") as f:
    keys = set(f.keys())
    for i, node in enumerate(nodes):
        src = sources(node.name)
        if src is None or any(k not in keys for k in src):
            skipped.append(node.name)
            continue
        packed, scales, zp = compute(node, [f.get_tensor(k) for k in src])
        pub_q = stored(init[node.input[1]], "uint8")
        pub_s = stored(init[node.input[2]], "float32")
        ours_q = packed.reshape(-1)
        kind = re.sub(r"\d+", "N", node.name)
        r = res[kind]
        r["n"] += 1
        same = ours_q.size == pub_q.size and float((ours_q == pub_q).mean()) or 0.0
        err = float(np.max(np.abs(scales.reshape(-1) - pub_s) / (np.abs(pub_s) + 1e-12))) if scales.size == pub_s.size else -1.0
        r["identical"] += int(same == 1.0 and err < 1e-3)
        r["bytes_equal"] += same
        r["scale_err"] = max(r["scale_err"], err)
        if i < 3 or same < 0.99:
            if len(examples) < 8:
                examples.append((node.name, ours_q.size, pub_q.size, round(same, 4), err))
        del packed, scales, zp
        if i % 40 == 0:
            print(f"{i}/{len(nodes)} {time.time()-start:.0f}s", flush=True)
for k, r in res.items():
    r["bytes_equal"] = round(r["bytes_equal"] / r["n"], 5)
print(json.dumps(res, indent=1, ensure_ascii=False))
print("skipped", skipped[:6], len(skipped))
print("examples", examples)
print("nodes checked", sum(r["n"] for r in res.values()), "identical", sum(r["identical"] for r in res.values()))
