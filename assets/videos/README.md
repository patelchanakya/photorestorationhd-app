# Video Assets for Back to Life Feature

Place your video files here with these specifications:

## Recommended Video Specs
- Format: MP4 (H.264)
- Resolution: 720x1280 (portrait)
- Duration: 2-4 seconds
- Frame rate: 30fps
- File size: < 3MB

## Example Files to Add:
- `back-to-life-1.mp4` - Old damaged photo transforming to restored
- `back-to-life-2.mp4` - Black & white to colorized animation

## How to Compress Videos:
```bash
# Using ffmpeg to compress:
ffmpeg -i input.mp4 -vcodec h264 -acodec aac -crf 28 -preset fast -vf "scale=720:1280" output.mp4

# For GIF conversion:
ffmpeg -i input.mp4 -vf "fps=15,scale=360:-1:flags=lanczos" -c:v gif output.gif
```

## Free Tools to Create Videos:
1. **Canva** - Create before/after animations
2. **After Effects** - Professional transitions
3. **DaVinci Resolve** - Free video editor
4. **ezgif.com** - Online GIF maker/optimizer