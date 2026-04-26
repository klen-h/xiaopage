// 已迁移到 Cloudflare D1，不再使用 CloudBase
// import cloudbaseSDK from '@cloudbase/js-sdk';

// export const cloudbase = cloudbaseSDK.init({
//   env: import.meta.env.VITE_CLOUDBASE_ENV_ID,
//   region: import.meta.env.VITE_CLOUDBASE_REGION,
//   accessKey: import.meta.env.VITE_CLOUDBASE_ACCESS_KEY
// });

// export const db = cloudbase.database();
// export const auth = cloudbase.auth();

// export const login = async () => {
//   const loginState = await auth.getLoginState();
//   if (!loginState) {
//     await auth.anonymousAuthProvider().signIn();
//   }
// };

export const cloudbase = null;
export const db = null;
export const login = async () => {};


