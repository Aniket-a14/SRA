import json
import os

def analyze_tokens(file_path):
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stats = []
    for line in lines:
        if not line.strip():
            continue
        data = json.loads(line)
        # We assume 1 token = ~4 characters for a safe heuristic
        total_chars = len(data.get('instruction', '')) + len(data.get('input', '')) + len(data.get('output', ''))
        est_tokens = total_chars / 4
        stats.append(est_tokens)

    if not stats:
        print("No data found in file.")
        return

    max_tokens = max(stats)
    min_tokens = min(stats)
    avg_tokens = sum(stats) / len(stats)
    
    over_4k = len([s for s in stats if s > 4096])
    over_8k = len([s for s in stats if s > 8192])
    over_16k = len([s for s in stats if s > 16384])

    print(f"\n📊 DATASET ANALYSIS: {file_path}")
    print("=" * 40)
    print(f"Total Samples: {len(stats)}")
    print(f"Average Estimated Tokens: {avg_tokens:,.0f}")
    print(f"Maximum Estimated Tokens: {max_tokens:,.0f}")
    print(f"Minimum Estimated Tokens: {min_tokens:,.0f}")
    print("-" * 40)
    print(f"Samples > 4k Tokens:   {over_4k} ({over_4k/len(stats):.1%})")
    print(f"Samples > 8k Tokens:   {over_8k} ({over_8k/len(stats):.1%})")
    print(f"Samples > 16k Tokens:  {over_16k} ({over_16k/len(stats):.1%})")
    print(f"Samples > 32k Tokens:  {len([s for s in stats if s > 32768])} ({len([s for s in stats if s > 32768])/len(stats):.1%})")
    print(f"Samples > 64k Tokens:  {len([s for s in stats if s > 65536])} ({len([s for s in stats if s > 65536])/len(stats):.1%})")
    print(f"Samples > 128k Tokens: {len([s for s in stats if s > 131072])} ({len([s for s in stats if s > 131072])/len(stats):.1%})")
    print("=" * 40)

if __name__ == "__main__":
    analyze_tokens("train_sft.jsonl")
