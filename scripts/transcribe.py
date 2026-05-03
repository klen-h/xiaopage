import sys
import json
import os

# 设置模型缓存目录（和 Actions 缓存路径一致）
os.environ['HF_HOME'] = os.path.expanduser('~/.cache/huggingface')
os.environ['CT2_CACHE'] = os.path.expanduser('~/.cache/ctranslate2')

from faster_whisper import WhisperModel

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "缺少音频路径参数"}), file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    
    # CPU + int8 量化
    model = WhisperModel(
        model_size, 
        device="cpu", 
        compute_type="int8",
        download_root=os.path.expanduser('~/.cache/huggingface/hub')
    )
    
    segments, info = model.transcribe(
        audio_path, 
        language="zh",
        beam_size=5,
        vad_filter=True
    )
    
    text = "".join([s.text for s in segments])
    result = {
        "text": text,
        "language": info.language,
        "duration": info.duration
    }
    
    # 输出 JSON 到 stdout
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()