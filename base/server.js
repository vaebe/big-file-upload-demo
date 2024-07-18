const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const app = express();

// 设置静态文件目录
app.use(express.static(path.join(__dirname, "public")));

// 定义根路由返回 index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 设置上传文件的存储目录
const upload = multer({ dest: path.join(__dirname, "uploads") });

const fileUploadStatus = new Map();

// 处理文件上传
app.post("/upload", upload.single("file"), async (req, res) => {
  const { chunkIndex, totalChunks, fileName } = req.body;
  const chunkDir = path.join(__dirname, "uploads", `${fileName}-chunks`);

  try {
    // 确保分片目录存在
    await fs.ensureDir(chunkDir);

    // 移动上传的分片到目标目录
    const chunkPath = path.join(chunkDir, chunkIndex.toString());
    await fs.move(req.file.path, chunkPath);

    // 更新内存中的上传状态
    if (!fileUploadStatus.has(fileName)) {
      fileUploadStatus.set(fileName, {
        receivedChunks: 0,
        totalChunks: Number(totalChunks)
      });
    }

    const fileStatus = fileUploadStatus.get(fileName);
    fileStatus.receivedChunks += 1;

    // 检查是否所有分片都已接收完成
    if (fileStatus.receivedChunks === fileStatus.totalChunks) {

        console.log(fileName, chunkDir, '-=-=-=-=')
      await mergeChunks(fileName); // 合并分片成最终文件
      await cleanupChunks(chunkDir); // 删除分片目录
      fileUploadStatus.delete(fileName); // 上传完成后删除 map 中的条目
      res.send({ message: "文件上传完成" });
    } else {
      res.send({ message: "分片上传成功" });
    }
  } catch (error) {
    console.error("文件上传处理出错:", error);
    res.status(500).send({ message: "文件上传处理出错" });
  }
});

// 合并分片成最终文件
async function mergeChunks(fileName) {
  const chunkDir = path.join(__dirname, "uploads", `${fileName}-chunks`);
  // 创建写入流
  const finalFilePath = path.join(__dirname, "uploads", fileName);
  const writeStream = fs.createWriteStream(finalFilePath);

  // 读取并写入每个分片
  const chunkFiles = await fs.readdir(chunkDir);
  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkFilePath = path.join(chunkDir, chunkFiles[i]);
    const chunk = await fs.readFile(chunkFilePath);
    writeStream.write(chunk);
    await fs.unlink(chunkFilePath); // 删除分片文件
  }

  writeStream.end();
}

// 删除分片目录
async function cleanupChunks(chunkDir) {
  await fs.remove(chunkDir);
}

// 启动服务器
app.listen(3000, () => {
  console.log(`服务器成功启动`);
  console.log("访问地址：http://localhost:3000");
});
