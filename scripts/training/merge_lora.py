"""Adds a trained LoRA adapter to Gemma 4 E2B's original weights, without loading the model.

usage: merge_lora.py <base model.safetensors> <adapter folder> <out .safetensors>
       merge_lora.py --check

Each trained matrix becomes W + (alpha / r) * B * A; every other tensor is written back bit for bit,
which is what lets swap_weights.py verify that training changed only what it can store.
"""
import json
import sys
from pathlib import Path

import torch
from safetensors import safe_open
from safetensors.torch import load_file, save_file

PREFIX = "base_model.model."
A_SUFFIX = ".lora_A.weight"
B_SUFFIX = ".lora_B.weight"
# Options that change the formula above: an adapter using one of them is refused, not guessed at.
MUST_BE_OFF = ("use_dora", "fan_in_fan_out", "use_rmsnorm", "rank_pattern", "alpha_pattern")


def merge(base_path, adapter_dir, out_path):
    adapter_dir = Path(adapter_dir)
    config = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
    used = [name for name in MUST_BE_OFF if config.get(name)]
    if used or config.get("bias", "none") != "none" or config.get("modules_to_save"):
        raise SystemExit(f"this adapter needs a merge this file does not do: {used or config}")
    scale = config["lora_alpha"] / config["r"]
    lora = load_file(adapter_dir / "adapter_model.safetensors")
    pairs = sorted(k for k in lora if k.endswith(A_SUFFIX))
    if not pairs or len(lora) != 2 * len(pairs):
        raise SystemExit(f"expected A and B matrices only, found {len(lora)} tensors")

    weights = {}
    with safe_open(base_path, "pt") as base:
        for key in base.keys():
            weights[key] = base.get_tensor(key)
    for key in pairs:
        if not key.startswith(PREFIX):
            raise SystemExit(f"unexpected adapter name: {key}")
        name = key[len(PREFIX) : -len(A_SUFFIX)] + ".weight"
        if name not in weights:
            raise SystemExit(f"the adapter trains {name}, which the base file does not have")
        original = weights[name]
        delta = scale * (lora[key[: -len(A_SUFFIX)] + B_SUFFIX].float() @ lora[key].float())
        if delta.shape != original.shape:
            raise SystemExit(f"{name}: adapter {tuple(delta.shape)}, base {tuple(original.shape)}")
        weights[name] = (original.float() + delta).to(original.dtype)
    save_file(weights, out_path, metadata={"format": "pt"})
    print(f"merged {len(pairs)} matrices into {out_path}")


def check():
    import tempfile

    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder)
        w = torch.tensor([[1.0, 2.0], [3.0, 4.0]], dtype=torch.bfloat16)
        other = torch.tensor([0.1, 0.2], dtype=torch.bfloat16)
        save_file({"m.layer.weight": w, "m.norm.weight": other}, root / "base.safetensors")
        name = "base_model.model.m.layer"
        a = torch.tensor([[1.0, 0.0]])
        b = torch.tensor([[2.0], [0.0]])
        save_file({f"{name}.lora_A.weight": a, f"{name}.lora_B.weight": b}, root / "adapter_model.safetensors")
        config = {"r": 1, "lora_alpha": 2, "bias": "none"}
        (root / "adapter_config.json").write_text(json.dumps(config), encoding="utf-8")
        merge(root / "base.safetensors", root, root / "out.safetensors")
        out = load_file(root / "out.safetensors")
        # W + (2 / 1) * [[2], [0]] * [[1, 0]] = [[1 + 4, 2], [3, 4]]
        assert out["m.layer.weight"].tolist() == [[5.0, 2.0], [3.0, 4.0]], "the formula"
        assert out["m.layer.weight"].dtype == torch.bfloat16, "the dtype is kept"
        assert torch.equal(out["m.norm.weight"], other), "other weights are untouched"
        config["use_dora"] = True
        (root / "adapter_config.json").write_text(json.dumps(config), encoding="utf-8")
        try:
            merge(root / "base.safetensors", root, root / "out2.safetensors")
        except SystemExit:
            print("merge_lora.py checks passed")
            return
        raise AssertionError("an adapter using DoRA must be refused")


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        check()
    elif len(sys.argv) == 4:
        merge(*sys.argv[1:])
    else:
        sys.exit(__doc__)
