import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setPixelFormat("yuv420p");
// Vertical mobile video (9:16)
Config.overrideWebpackConfig((config) => config);
