import json, wave, re, subprocess
import numpy as np
P=json.load(open('vo/plan.json')); S=json.load(open('script.json'))
def ts(x):
    ms=int(round(x*1000)); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'
for vid in P:
    total=P[vid][-1]['start']+P[vid][-1]['dur']
    text={x['id']:x for x in S[vid]}
    for lang in ('en','hi'):
        sr=None; buf=None; cues=[]
        for sc in P[vid]:
            with wave.open(f"vo/{vid}-{sc['id']}-{lang}.wav") as w:
                sr=w.getframerate(); a=np.frombuffer(w.readframes(w.getnframes()),np.int16)
            if buf is None: buf=np.zeros(int(total*sr)+sr,np.int16)
            i=int(sc['vo']*sr); buf[i:i+len(a)]=a
            d=len(a)/sr
            # split into sentences, time proportional to length
            parts=[p.strip() for p in re.split(r'(?<=[.?!।])\s+',text[sc['id']][lang]) if p.strip()]
            L=sum(len(p) for p in parts); t=sc['vo']
            for p in parts:
                dd=d*len(p)/L; cues.append((t,t+dd,p)); t+=dd
        buf=buf[:int(total*sr)]
        base=f'out/{vid}-voice-{lang}'
        with wave.open(base+'-raw.wav','w') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(buf.tobytes())
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',base+'-raw.wav','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ar','48000','-ac','2',base+'.wav'],check=True)
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',base+'.wav','-c:a','libmp3lame','-b:a','192k',base+'.mp3'],check=True)
        with open(f'out/{vid}-subtitles-{lang}.srt','w') as f:
            for n,(a,b,p) in enumerate(cues,1): f.write(f'{n}\n{ts(a)} --> {ts(b)}\n{p}\n\n')
        print(base, round(total,2))
