export default class CreateChunks {
  file: File;
  setProgress;
  chunkSum = 0;
  chunkSize = 0;
  defualtChunkSize = 1 * 1024 * 1024; // 最大容量块 1MB

  constructor(
    file: File,
    setProgress: (n: number) => number,
    chunkSize?: number
  ) {
    this.file = file as File;
    this.setProgress = setProgress;
    this.defualtChunkSize = chunkSize || 0;
    this.chunkSize = chunkSize || this.defualtChunkSize;
    this.chunkSum = Math.ceil((file as File).size / this.defualtChunkSize);
  }

  async createFileChunks(): Promise<IFileChunkList[]> {
    let start = 0;
    const fileChunkList = [] as IFileChunkList[];
    const chunkSize = Math.ceil(this.file.size / this.chunkSum);
    for (let i = 0; i < this.chunkSum; i++) {
      const end = start + chunkSize;
      fileChunkList.push({
        index: i,
        filename: this.file?.name,
        chunk: this.file.slice(start, end),
      });
      start = end;
    }

    return fileChunkList;
  }
}
