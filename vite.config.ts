import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import javascriptObfuscator from "vite-plugin-javascript-obfuscator";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "production" &&
      javascriptObfuscator({
        options: {
          compact: true,
          identifierNamesGenerator: "hexadecimal",
          renameGlobals: false,
          stringArray: true,
          stringArrayEncoding: ["base64"],
          stringArrayThreshold: 0.75,
          deadCodeInjection: false,
          controlFlowFlattening: false,
        },
      }),
  ].filter(Boolean),
  base: "./",
}));
