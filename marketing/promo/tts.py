import json, subprocess, wave, sys
import os
T=os.environ.get('PIPER_DIR','tts')
S=json.load(open('script.json'))
VOICE={('buyer','hi'):'hi_IN-priyamvada-medium',('creator','hi'):'hi_IN-pratham-medium',('buyer','en'):'en_US-lessac-medium',('creator','en'):'en_US-lessac-medium'}
dur={}
for vid,scenes in S.items():
  for sc in scenes:
    for lang in ('en','hi'):
      out=f"vo/{vid}-{sc['id']}-{lang}.wav"
      subprocess.run([f'{T}/venv/bin/piper','-m',f"{T}/voices/{VOICE[(vid,lang)]}.onnx",'--length-scale','1.08','--sentence-silence','0.25','-f',out],input=sc[lang].encode(),check=True,capture_output=True)
      with wave.open(out) as w: d=w.getnframes()/w.getframerate()
      dur[f"{vid}/{sc['id']}/{lang}"]=round(d,2)
json.dump(dur,open('vo/durations.json','w'),indent=1)
for k,v in dur.items(): print(k,v)
