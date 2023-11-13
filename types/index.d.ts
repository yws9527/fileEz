export type Recordable<T = any> = Record<string, T>;

export declare function fileSizeHandle(file: File): Promise<any>;

export interface IFileHandleThread extends Worker {
  id?: number;
  busy?: boolean;
  taskMap?: Recordable;
}

export interface IFileChunkList {
  chunk: Blob;
  index: number;
  hash?: string;
  filename: string;
}

export interface IFileHandleOptions {
  maximumWorkTime: number;
  defualtChunkSize: number;
  inspectIntervalTime: number;
}

export interface IFileEz {
  hash: string;
  chunks: IFileChunkList[];
  state: 0 | 1; // 0 - <= 10MB 直传OSS   1 - > 10MB 切片上传OSS
}

export interface IFileThreadData {
  msg?: string;
  code?: number;
  taskId: number;
  data?: Recordable;
}

export interface IFileMessageEventData {
  threadCode: 0 | 1; // 成功为0，错误为1
  threadMsg: string; // 表示消息错误的报错信息。非必须的
  channel: 'fetch' | 'inspection' | 'hash'; // 表示数据频道，因为我们可能通过子线程做其他工作
  threadData: IFileThreadData; // 表示消息真正的数据载体对象, 错误情况时只有 taskId
}
