/**
 * 读取 GLB 文件并列出所有网格（mesh）名称与层级
 * 用法: node scripts/inspect-glb-meshes.mjs [路径]
 * 默认路径: src/assets/models/111.glb
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultPath = path.join(root, "src/assets/models/111.glb");

const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

if (!fs.existsSync(filePath)) {
  console.error("文件不存在:", filePath);
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

// GLB: magic(4) + version(4) + length(4) = 12
const magic = new TextDecoder().decode(buffer.subarray(0, 4));
if (magic !== "glTF") {
  console.error("不是有效的 GLB 文件 (magic:", magic, ")");
  process.exit(1);
}
const version = view.getUint32(4, true);
const totalLength = view.getUint32(8, true);
console.log("GLB 版本:", version, "  文件总长:", totalLength, "bytes\n");

let offset = 12;
const jsonChunkLength = view.getUint32(offset, true);
const jsonChunkType = view.getUint32(offset + 4, true);
offset += 8;

if (jsonChunkType !== 0x4e4f534a) {
  console.error("未找到 JSON 块 (type:", jsonChunkType.toString(16), ")");
  process.exit(1);
}

const jsonBytes = buffer.subarray(offset, offset + jsonChunkLength);
const jsonText = new TextDecoder().decode(jsonBytes);
const gltf = JSON.parse(jsonText);

// 列出所有 mesh
const meshes = gltf.meshes || [];
console.log("========== 网格列表 (meshes) ==========");
console.log("共", meshes.length, "个网格\n");

meshes.forEach((mesh, index) => {
  const name = mesh.name != null && mesh.name !== "" ? mesh.name : "(未命名)";
  const primitives = mesh.primitives ? mesh.primitives.length : 0;
  console.log(`  [${index}] ${name}  (primitives: ${primitives})`);
});

// 列出节点层级及引用的 mesh
const nodes = gltf.nodes || [];
console.log("\n========== 节点层级 (nodes → mesh) ==========");

function walkNodes(nodes, indices, prefix = "") {
  indices.forEach((i) => {
    const node = nodes[i];
    if (!node) return;
    const name = node.name != null && node.name !== "" ? node.name : "(未命名)";
    const meshIdx = node.mesh;
    const meshInfo =
      meshIdx !== undefined
        ? ` → mesh[${meshIdx}] "${(gltf.meshes && gltf.meshes[meshIdx] && gltf.meshes[meshIdx].name) || ""}"`
        : "";
    console.log(prefix + "• " + name + meshInfo);
    if (node.children && node.children.length) {
      walkNodes(nodes, node.children, prefix + "  ");
    }
  });
}

const sceneIndices = (gltf.scenes && gltf.scenes[0] && gltf.scenes[0].nodes) || (nodes.length ? [0] : []);
walkNodes(nodes, sceneIndices);

console.log("\n完成.");
