import json
import os
import random

def extract_samples(file_path, count=3):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    samples = random.sample(lines, min(count, len(lines)))
    extracted = []
    
    for i, line in enumerate(samples):
        data = json.loads(line)
        output = data.get('output', '')
        if isinstance(output, str):
            try:
                output = json.loads(output)
            except:
                continue
        
        # Search for mermaid blocks
        srs_str = json.dumps(output)
        import re
        matches = re.findall(r'```mermaid\s*([\s\S]*?)\s*```', srs_str)
        for j, m in enumerate(matches):
            extracted.append(f"Sample_{i}_Diagram_{j}.mmd\n{m.strip()}")
            
    with open('mermaid_samples_for_test.txt', 'w', encoding='utf-8') as f:
        f.write("\n---\n".join(extracted))
    print(f"Extracted {len(extracted)} diagrams for live testing.")

if __name__ == "__main__":
    extract_samples("train_sft.jsonl", 5)
