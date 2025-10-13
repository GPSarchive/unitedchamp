export const playerImgUrl = (path: string) =>
    `/api/storage/player-img?path=${encodeURIComponent(path)}`;
  
  export const maskUrl = (path: string) =>
    `/api/storage/mask?path=${encodeURIComponent(path)}`;
  