"""Trains a LoRA adapter for Gemma 4 E2B on AI Teacher's conversations (run on a GPU, e.g. Colab).

usage: train_teacher.py --data <folder with train.jsonl, valid.jsonl> --out <folder>
       train_teacher.py --check      (a tiny random model on the CPU: no download, no GPU)

Only the adapter comes out: merge_lora.py adds it to the untouched bfloat16 weights afterwards, so
nothing but the trained layers changes and swap_weights.py can write them into the app's ONNX file.
The revision is pinned to the checkpoint q4_identity.py proved identical to the app's decoder.
"""
import argparse
import json
import math
import random
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model

MODEL = "google/gemma-4-e2b-it"
REVISION = "4adf15748de9e1a0097b6274cee9c15836c41c37"
END_OF_TURN = "<turn|>"
IGNORE = -100
# The layers the app's ONNX file stores as 4-bit weights (scripts/training/q4_weights.py), in the
# text model only: q4_weights.py has no vision or audio weights to write.
TARGETS = r"^(?!.*(vision|audio)).*layers\.\d+\.(self_attn\.(q|k|v|o)_proj|mlp\.(gate|up|down)_proj)$"


def encode(tokenizer, messages, max_length):
    """(input ids, labels): the prompt exactly as the app sends it; only the answer is learned."""
    prompt = tokenizer.apply_chat_template(messages[:-1], add_generation_prompt=True, tokenize=False)
    answer = messages[-1]["content"] + END_OF_TURN
    head = tokenizer(prompt, add_special_tokens=False)["input_ids"]
    tail = tokenizer(answer, add_special_tokens=False)["input_ids"]
    ids = (head + tail)[:max_length]
    labels = ([IGNORE] * len(head) + tail)[:max_length]
    return ids, labels


def batches(rows, size, pad_id, device, shuffle):
    order = list(range(len(rows)))
    if shuffle:
        random.shuffle(order)
    for start in range(0, len(order), size):
        part = [rows[i] for i in order[start : start + size]]
        length = max(len(ids) for ids, _ in part)
        pad = lambda seq, value: seq + [value] * (length - len(seq))  # noqa: E731
        yield {
            "input_ids": torch.tensor([pad(i, pad_id) for i, _ in part], device=device),
            "attention_mask": torch.tensor(
                [[1] * len(i) + [0] * (length - len(i)) for i, _ in part], device=device
            ),
            "labels": torch.tensor([pad(l, IGNORE) for _, l in part], device=device),
        }


def adapted(model, rank):
    config = LoraConfig(r=rank, lora_alpha=rank, target_modules=TARGETS, bias="none")
    return get_peft_model(model, config)


@torch.no_grad()
def loss_on(model, rows, size, pad_id, device, autocast):
    model.eval()
    total = 0.0
    count = 0
    for batch in batches(rows, size, pad_id, device, False):
        with autocast():
            loss = model(**batch, use_cache=False).loss
        total += float(loss) * batch["input_ids"].size(0)
        count += batch["input_ids"].size(0)
    return total / max(count, 1)


def train(model, data, valid, args, pad_id, device, autocast, out):
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(params, lr=args.lr, weight_decay=0.0)
    steps = args.epochs * math.ceil(len(data) / args.batch / args.accumulate)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=args.lr, total_steps=max(steps, 2))
    best = math.inf
    done = 0
    for epoch in range(args.epochs):
        model.train()
        pending = 0
        running = 0.0
        for n, batch in enumerate(batches(data, args.batch, pad_id, device, True)):
            with autocast():
                loss = model(**batch, use_cache=False).loss / args.accumulate
            if not torch.isfinite(loss):
                raise RuntimeError("the loss is not a number: lower --lr and start again")
            loss.backward()
            running += float(loss.detach())
            pending += 1
            if pending == args.accumulate:
                torch.nn.utils.clip_grad_norm_(params, 1.0)
                optimizer.step()
                if done < steps:
                    scheduler.step()
                optimizer.zero_grad(set_to_none=True)
                pending = 0
                done += 1
                if done % 20 == 0:
                    print(f"step {done}/{steps}  loss {running / 20:.4f}", flush=True)
                    running = 0.0
        current = loss_on(model, valid, args.batch, pad_id, device, autocast)
        print(f"epoch {epoch + 1}/{args.epochs}  validation loss {current:.4f}", flush=True)
        if current < best:
            best = current
            model.save_pretrained(out)
            print(f"saved the adapter to {out}", flush=True)
    return best


def read_rows(path, tokenizer, max_length):
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line]
    return [encode(tokenizer, r["messages"], max_length) for r in rows]


def options(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--data")
    p.add_argument("--out")
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--batch", type=int, default=2)
    p.add_argument("--accumulate", type=int, default=4)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--rank", type=int, default=32)
    p.add_argument("--max-length", type=int, default=1536)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--check", action="store_true")
    return p.parse_args(argv)


def main():
    from torch.amp import autocast as amp
    from transformers import AutoModelForCausalLM, AutoTokenizer

    args = options()
    if args.check:
        check()
        return
    if not args.data or not args.out:
        raise SystemExit("--data and --out are required")
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if not torch.cuda.is_available():
        raise SystemExit("no GPU: in Colab choose Runtime > Change runtime type > T4 GPU")

    tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    train_rows = read_rows(Path(args.data) / "train.jsonl", tokenizer, args.max_length)
    valid_rows = read_rows(Path(args.data) / "valid.jsonl", tokenizer, args.max_length)
    print(f"{len(train_rows)} training and {len(valid_rows)} validation conversations", flush=True)

    # float16 on the GPU only: the merge starts again from the original bfloat16 weights.
    model = AutoModelForCausalLM.from_pretrained(
        MODEL, revision=REVISION, dtype=torch.float16, device_map={"": 0}
    )
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model = adapted(model, args.rank)
    model.print_trainable_parameters()

    autocast = lambda: amp("cuda", dtype=torch.float16)  # noqa: E731
    pad_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0
    print(
        f"validation loss before training: "
        f"{loss_on(model, valid_rows, args.batch, pad_id, 'cuda', autocast):.4f}",
        flush=True,
    )
    best = train(model, train_rows, valid_rows, args, pad_id, "cuda", autocast, args.out)
    print(f"done: the best validation loss was {best:.4f}, adapter in {args.out}", flush=True)


def check():
    """A random two-layer Gemma 4 text model: the labels, the LoRA names and one training step."""
    import contextlib
    import tempfile

    from safetensors.torch import load_file, save_file
    from transformers import Gemma4ForCausalLM, Gemma4TextConfig

    from merge_lora import merge

    class Tokens:
        pad_token_id = 0

        def apply_chat_template(self, messages, add_generation_prompt, tokenize):
            assert add_generation_prompt and not tokenize
            return "".join(m["content"] for m in messages)

        def __call__(self, text, add_special_tokens):
            assert not add_special_tokens
            return {"input_ids": [3 + (ord(c) % 40) for c in text]}

    messages = [
        {"role": "system", "content": "abc"},
        {"role": "user", "content": "de"},
        {"role": "assistant", "content": "fgh"},
    ]
    ids, labels = encode(Tokens(), messages, 100)
    answer = len("fgh") + len(END_OF_TURN)
    assert len(ids) == len(labels) == 5 + answer, "prompt and answer are both in the ids"
    assert labels[:5] == [IGNORE] * 5, "the prompt is not learned"
    assert labels[5:] == ids[5:], "the answer is learned, the end-of-turn mark included"
    cut_ids, cut_labels = encode(Tokens(), messages, 6)
    assert len(cut_ids) == len(cut_labels) == 6, "too long a row is cut, not dropped"

    torch.manual_seed(1)
    config = Gemma4TextConfig(
        vocab_size=64,
        hidden_size=32,
        intermediate_size=48,
        num_hidden_layers=2,
        num_attention_heads=2,
        num_key_value_heads=2,
        head_dim=16,
    )
    model = adapted(Gemma4ForCausalLM(config).float(), 4)
    names = [n for n, p in model.named_parameters() if p.requires_grad]
    assert names and all("lora_" in n for n in names), "only the adapter is trained"
    args = options(["--epochs", "1", "--batch", "1", "--accumulate", "1", "--lr", "0.01"])
    data = [encode(Tokens(), messages, 100)] * 3
    with tempfile.TemporaryDirectory() as folder, contextlib.redirect_stdout(None):
        train(model, data, data, args, 0, "cpu", contextlib.nullcontext, folder)
        base = model.get_base_model().state_dict()
        # What the original checkpoint held, before the adapter was added.
        plain = {
            k.replace(".base_layer.", "."): v.clone()
            for k, v in base.items()
            if "lora_" not in k
        }
        path = Path(folder) / "base.safetensors"
        save_file({k: v.contiguous() for k, v in plain.items() if k != "lm_head.weight"}, path)
        merged_path = Path(folder) / "merged.safetensors"
        merge(path, folder, merged_path)
        ours = load_file(merged_path)
        theirs = model.merge_and_unload().state_dict()
    changed = 0
    for key, value in ours.items():
        assert torch.allclose(value, theirs[key], atol=1e-5), f"{key} differs from peft's merge"
        changed += int(not torch.equal(value, plain[key]))
    assert changed > 0, "the adapter changed something"
    print(f"train_teacher.py checks passed ({changed} weights changed by the adapter)")


if __name__ == "__main__":
    main()
