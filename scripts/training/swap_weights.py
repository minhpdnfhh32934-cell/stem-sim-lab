"""Writes trained Gemma 4 E2B weights into a copy of the app's ONNX decoder data.

usage: swap_weights.py <folder with decoder_model_merged_q4.onnx + .onnx_data>
                       <base model.safetensors> <trained model.safetensors> <output .onnx_data>

The graph file stays as published; only the 4-bit weights are recomputed, at their own offsets, so
every file size and offset is unchanged. It stops, writing nothing useful, if training changed a
weight this file cannot write (embeddings, norms, lm_head): half of a model must never ship.
"""
import shutil
import sys

import onnx
import torch
from safetensors import safe_open

from q4_weights import LM, compute, initializers, is_external, location, quant_nodes, sources

ref, base_path, trained_path, out = sys.argv[1:5]
ref = ref.rstrip("/\\") + "/"
model = onnx.load(ref + "decoder_model_merged_q4.onnx", load_external_data=False)
init = initializers(model)
nodes = quant_nodes(model)
covered = {k for n in nodes for k in (sources(n.name) or [])}

with safe_open(base_path, "pt") as base, safe_open(trained_path, "pt") as trained:
    base_keys, trained_keys = set(base.keys()), set(trained.keys())
    missing = sorted(covered - trained_keys)
    if missing:
        sys.exit(f"trained weights lack {len(missing)} tensors, e.g. {missing[:3]}")
    uncovered = []
    changed = set()
    for key in sorted(k for k in base_keys & trained_keys if k.startswith(LM) or "lm_head" in k):
        if not torch.equal(base.get_tensor(key), trained.get_tensor(key)):
            changed.add(key)
            if key not in covered:
                uncovered.append(key)
    if uncovered:
        sys.exit(f"training changed weights this writer cannot store: {uncovered[:5]}")
    print(f"{len(changed)} of {len(covered)} written tensors differ from the base model")

    shutil.copyfile(ref + "decoder_model_merged_q4.onnx_data", out)
    written = 0
    with open(out, "r+b") as f:
        for node in nodes:
            keys = sources(node.name)
            if keys is None:
                continue
            packed, scales, zero_point = compute(node, [trained.get_tensor(k) for k in keys])
            for index, array in ((1, packed), (2, scales), (3, zero_point)):
                t = init[node.input[index]]
                if not is_external(t):
                    sys.exit(f"{t.name} is stored inside the graph, not in the data file")
                offset, length = location(t)
                raw = array.tobytes()
                if len(raw) != length:
                    sys.exit(f"{t.name}: {len(raw)} bytes, the file holds {length}")
                f.seek(offset)
                f.write(raw)
            written += 1
print(f"wrote {written} weights to {out}")
