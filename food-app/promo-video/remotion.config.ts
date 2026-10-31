import { Config } from '@remotion/cli/config';

// Rendering settings for every composition: H.264 MP4 that LinkedIn accepts, high quality, JPEG frames.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
