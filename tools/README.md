# Face-chat transcript alignment

Generate static word timings from the recorded avatar audio:

```powershell
npm run align:transcripts
```

The tool decodes each dialogue `.webm` with the development-only `ffmpeg-static` binary, runs
local Whisper word-timestamp inference, aligns Whisper's words to the authoritative text in
`transcriptScript.ts`, and writes `transcriptTimings.json`. The model is cached under the ignored
`.cache/` directory. None of the model, FFmpeg, or alignment code is imported by the website.

To regenerate one or more updated recordings while preserving the other generated entries:

```powershell
npm run align:transcripts -- --clip=1_0
npm run align:transcripts -- --clip=1_0,1_1
```

An alternative compatible Whisper model can be selected with `--model=<model-id>`.
