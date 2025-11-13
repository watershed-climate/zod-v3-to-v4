#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { Project, SourceFile } from "ts-morph";
import { migrateZodV3ToV4 } from "./migrate.ts";

// Get file path from CLI argument
// Ex: npx zod-v3-to-v4 path/to/your/file.ts
const args = process.argv.slice(2);
const filePath = args[0];

if (!filePath) {
  console.error("Error: No file path provided.");
  console.error("Usage: zod-v3-to-v4 <path-to-file>");
  process.exit(1);
}

const isValid = validateFilePath(filePath);
if (!isValid.success) {
  console.error(`Error: "${filePath}" is not a valid TypeScript file. ${isValid.reason}`);
  process.exit(1);
}

await runMigration(filePath);

function findClosestTsConfig(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    const tsConfigPath = path.join(currentDir, "tsconfig.json");
    if (fs.existsSync(tsConfigPath)) {
      return tsConfigPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached the root directory
      return null;
    }
    currentDir = parentDir;
  }
}

async function runMigration(filePath: string) {
  const absoluteFilePath = path.resolve(filePath);
  const fileDir = path.dirname(absoluteFilePath);

  // Find the closest tsconfig.json
  const tsConfigFilePath = findClosestTsConfig(fileDir);
  if (!tsConfigFilePath) {
    console.error("Error: No tsconfig.json found. Please ensure there's a tsconfig.json in the project.");
    process.exit(1);
  }

  console.log(`Found tsconfig.json at: ${tsConfigFilePath}`);
  console.log(`Processing file: ${absoluteFilePath}`);

  // Initialize ts-morph Project with the found tsconfig.json
  // Use skipFileDependencyResolution to prevent auto-loading files
  const project = new Project({
    tsConfigFilePath,
    skipFileDependencyResolution: true,
  });

  // Remove any files that were auto-loaded
  project.getSourceFiles().forEach((file: SourceFile) => {
    project.removeSourceFile(file);
  });

  // Add only the specific file to the project
  const sourceFile = project.addSourceFileAtPath(absoluteFilePath);

  try {
    migrateZodV3ToV4(sourceFile, { migrateImportDeclarations: true });
  } catch (err) {
    let message = `Failed to migrate ${sourceFile.getFilePath()}`;
    if (err instanceof Error) {
      message += `\nReason: ${err.message}`;
    }
    message += `\n\nPlease report this at https://github.com/nicoespeon/zod-v3-to-v4/issues`;
    console.error(message);
    process.exit(1);
  }

  // Save the changes
  await project.save();

  console.log("File has been migrated successfully.");
}

function validateFilePath(filePath: string) {
  const validExtensions = [".ts", ".tsx", ".js", ".jsx"];
  const ext = path.extname(filePath);

  if (!validExtensions.includes(ext)) {
    return {
      success: false,
      reason: "Please enter a valid TypeScript/JavaScript file path (.ts, .tsx, .js, .jsx).",
    } as const;
  }

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      reason: "File not found.",
    } as const;
  }

  return { success: true } as const;
}

