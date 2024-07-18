const { createApp, ref } = Vue;

const app = {
  setup() {
    const totalProgress = ref(0);
    const chunkProgresses = ref([]);
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const maxConcurrentUploads = 6; // 最大并发上传数

    const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        await uploadFile(file);
      }
    };

    const createChunks = (file) => {
      const chunks = [];
      const chunkCount = Math.ceil(file.size / chunkSize);
      for (let i = 0; i < chunkCount; i++) {
        const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
        chunks.push({ chunk, index: i });
      }
      chunkProgresses.value = Array(chunkCount).fill(0);
      return chunks;
    };

    const uploadChunk = async (chunkData, chunkCount, fileName) => {
      const { chunk, index } = chunkData;
      const formData = new FormData();
      formData.append("file", chunk);
      formData.append("chunkIndex", index);
      formData.append("totalChunks", chunkCount);
      formData.append("fileName", fileName);

      await axios.post("/upload", formData, {
        onUploadProgress: (progressEvent) => {
          chunkProgresses.value[index] = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100,
          );
          updateTotalProgress(chunkCount);
        },
      });
    };

    const updateTotalProgress = (chunkCount) => {
      const uploadedChunks = chunkProgresses.value.filter(
        (progress) => progress === 100,
      ).length;
      totalProgress.value = Math.round((uploadedChunks / chunkCount) * 100);
    };

    const uploadFile = async (file) => {
      const chunks = createChunks(file);
      const chunkCount = chunks.length;
      const fileName = file.name;

      await uploadChunksConcurrently(chunks, chunkCount, fileName);
    };

    const uploadChunksConcurrently = async (chunks, chunkCount, fileName) => {
      const promises = [];
      for (let i = 0; i < chunks.length; i++) {
        promises.push(uploadChunk(chunks[i], chunkCount, fileName));

        if (
          promises.length === maxConcurrentUploads ||
          i === chunks.length - 1
        ) {
          await Promise.all(promises);
          promises.length = 0; // 清空数组
        }
      }
    };

    return {
      totalProgress,
      chunkProgresses,
      handleFileChange,
    };
  },
};

createApp(app).mount("#app");
