import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const BVID = 'BV1m6oSBtEGF';
const CID = '37812505098';

// 1. 导出Cookie
const tempDir = path.resolve('temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
const cookieFile = path.join(tempDir, 'bili_cookies.txt');

console.log('导出Cookie...');
try {
  execSync(`yt-dlp --cookies-from-browser edge --cookies "${cookieFile}" --skip-download "https://www.bilibili.com"`, 
    { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
} catch (e) {
  // 忽略错误，Cookie文件可能已生成
}

// 2. 读取并清理Cookie
const rawCookies = fs.readFileSync(cookieFile, 'utf-8');
const cookieStr = rawCookies
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#') && line.includes('bilibili'))
  .map(line => {
    const parts = line.split('\t');
    if (parts.length >= 7) {
      const name = parts[5].trim();
      const value = parts[6].trim();
      return `${name}=${value}`;
    }
    return '';
  })
  .filter(Boolean)
  .join('; ');

console.log('Cookie长度:', cookieStr.length);
console.log('Cookie前100字符:', cookieStr.slice(0, 100));

// 3. 调用API
console.log('\n调用字幕API...');
const url = `https://api.bilibili.com/x/player/wbi/v2?cid=${CID}&bvid=${BVID}`;
try {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com',
      'Cookie': cookieStr
    },
    timeout: 15000
  });

  console.log('code:', res.data.code);
  console.log('message:', res.data.message);
  
  const subs = res.data.data?.subtitle?.subtitles || [];
  console.log('字幕数量:', subs.length);
  subs.forEach(s => {
    console.log(`  - lan: ${s.lan}, doc: ${s.lan_doc}`);
    console.log(`    url: ${s.subtitle_url?.slice(0, 80)}...`);
  });

  // 4. 如果有字幕，下载并解析
  if (subs.length > 0) {
    const zhSub = subs.find(s => s.lan === 'ai-zh') || subs[0];
    let subUrl = zhSub.subtitle_url;
    if (subUrl.startsWith('//')) subUrl = 'https:' + subUrl;
    
    console.log('\n下载字幕...');
    const subRes = await axios.get(subUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.bilibili.com'
      }
    });
    
    const body = subRes.data?.body || [];
    console.log('字幕条目数:', body.length);
    console.log('前5条:');
    body.slice(0, 5).forEach(item => {
      console.log(`  [${item.from}s - ${item.to}s] ${item.content}`);
    });
    
    const fullText = body.map(i => i.content).join('\n');
    console.log('\n总字数:', fullText.length);
  }
} catch (error) {
  console.error('API错误:', error.message);
}

// 清理
if (fs.existsSync(cookieFile)) fs.unlinkSync(cookieFile);
