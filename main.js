/* ------------------------------------------------------------------
 * 주석 찾기 (Commentary Finder) — Obsidian plugin
 * PC에 있는 주석 PDF를 장절 색인(commentary-index.json)으로 찾아
 * 해당 쪽을 PDF 뷰어(Acrobat / Edge / Chrome)로 바로 연다.
 * PDF 원본은 보관함 밖에 그대로 두므로 동기화 용량에 영향이 없다.
 * 성경 찾기(obsidian-bible-finder) 플러그인은 수정하지 않고,
 * 그 화면의 현재 검색어만 읽어서 따라간다(자동 연동).
 * ------------------------------------------------------------------ */
'use strict';

const { Plugin, ItemView, Notice, PluginSettingTab, Setting, setIcon, MarkdownView, MarkdownRenderer, requestUrl, Platform } = require('obsidian');

const VIEW_TYPE = 'sermon-commentary-view';
const VIEW_TYPE_DICT = 'sermon-bible-dictionary-view';
const INDEX_FILE = 'commentary-index.json';

/* 책 번호(1~66), 전체 이름, 약어/별칭 */
const BOOKS = [
  [1, '창세기', ['창', '창세']], [2, '출애굽기', ['출', '출애굽']], [3, '레위기', ['레', '레위']], [4, '민수기', ['민', '민수']],
  [5, '신명기', ['신', '신명']], [6, '여호수아', ['수', '여호']], [7, '사사기', ['삿', '사사']], [8, '룻기', ['룻']],
  [9, '사무엘상', ['삼상', '사무웰상', '사무앨상']], [10, '사무엘하', ['삼하', '사무웰하', '사무앨하']], [11, '열왕기상', ['왕상']], [12, '열왕기하', ['왕하']],
  [13, '역대상', ['대상']], [14, '역대하', ['대하']], [15, '에스라', ['스']], [16, '느헤미야', ['느']],
  [17, '에스더', ['에']], [18, '욥기', ['욥', '용']], [19, '시편', ['시']], [20, '잠언', ['잠']],
  [21, '전도서', ['전']], [22, '아가', ['아', '아가서']], [23, '이사야', ['사']], [24, '예레미야', ['렘']],
  [25, '예레미야애가', ['애', '애가', '예레미야 애가']], [26, '에스겔', ['겔']], [27, '다니엘', ['단']], [28, '호세아', ['호']],
  [29, '요엘', ['욜']], [30, '아모스', ['암']], [31, '오바댜', ['옵']], [32, '요나', ['욘']],
  [33, '미가', ['미']], [34, '나훔', ['나']], [35, '하박국', ['합']], [36, '스바냐', ['습']],
  [37, '학개', ['학']], [38, '스가랴', ['슥']], [39, '말라기', ['말']],
  [40, '마태복음', ['마', '마태']], [41, '마가복음', ['막', '마가']], [42, '누가복음', ['눅', '누가', '녹']], [43, '요한복음', ['요', '요한']],
  [44, '사도행전', ['행']], [45, '로마서', ['롬', '로마', '롭']], [46, '고린도전서', ['고전', '린도전서']], [47, '고린도후서', ['고후', '린도후서']],
  [48, '갈라디아서', ['갈']], [49, '에베소서', ['엡', '엠', '앨']], [50, '빌립보서', ['빌', '힐']], [51, '골로새서', ['골']],
  [52, '데살로니가전서', ['살전']], [53, '데살로니가후서', ['살후']], [54, '디모데전서', ['딤전', '띱전', '덤전']], [55, '디모데후서', ['딤후', '띱후', '덤후']],
  [56, '디도서', ['딛']], [57, '빌레몬서', ['몬']], [58, '히브리서', ['히']], [59, '야고보서', ['약']],
  [60, '베드로전서', ['벧전', '뻗전', '벤전']], [61, '베드로후서', ['벧후', '뻗후', '벤후']], [62, '요한일서', ['요일', '요한1서']], [63, '요한이서', ['요이', '요한2서']],
  [64, '요한삼서', ['요삼', '요한3서']], [65, '유다서', ['유']], [66, '요한계시록', ['계', '계시록', '한계시록']],
];
const BOOK_NAME = {};
const BOOK_SHORT = {};
const BOOK_KEYS = []; // [key, no] — 긴 것부터
for (const [no, full, abbr] of BOOKS) {
  BOOK_NAME[no] = full;
  BOOK_SHORT[no] = abbr[0];
  BOOK_KEYS.push([full, no]);
  for (const a of abbr) BOOK_KEYS.push([a.replace(/\s+/g, ''), no]);
}
BOOK_KEYS.sort((a, b) => b[0].length - a[0].length);

const MAX_CHAPTERS = {
  1: 50, 2: 40, 3: 27, 4: 36, 5: 34, 6: 24, 7: 21, 8: 4, 9: 31, 10: 24,
  11: 22, 12: 25, 13: 29, 14: 36, 15: 10, 16: 13, 17: 10, 18: 42, 19: 150, 20: 31,
  21: 12, 22: 8, 23: 66, 24: 52, 25: 5, 26: 48, 27: 12, 28: 14, 29: 3, 30: 9,
  31: 1, 32: 4, 33: 7, 34: 3, 35: 3, 36: 3, 37: 2, 38: 14, 39: 4,
  40: 28, 41: 16, 42: 24, 43: 21, 44: 28, 45: 16, 46: 16, 47: 13, 48: 6, 49: 6,
  50: 4, 51: 4, 52: 5, 53: 3, 54: 6, 55: 4, 56: 3, 57: 1, 58: 13, 59: 5,
  60: 5, 61: 3, 62: 5, 63: 1, 64: 1, 65: 1, 66: 22
};

const DEFAULT_SETTINGS = {
  viewer: 'system',           // system (기본 프로그램 - 추천) | edge | chrome | acrobat
  acrobatPath: 'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe',
  edgePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  autoFollow: true,           // 성경 찾기 화면의 검색 장절을 따라가기
  autoFollowEditor: false,    // 에디터 커서 위치의 장절을 자동으로 따라가기
  dictAutoFollowEditor: true, // 에디터 커서/선택 단어를 성경사전에서 자동 조회
  dictFontSize: 15,           // 성경사전 본문 글꼴 크기 (px)
  bookNameFormat: 'auto',     // auto (성경 찾기와 일치) | short (약어) | full (전체 이름)
  showChapterLevel: true,     // 장 전체 관련 자료(설교·연구자료 등)도 보이기
  autoExpandText: true,       // 검색 시 주석 텍스트 전문 자동 펼치기
  geminiApiKey: '',           // 비어있으면 sermon-mindmap의 API 키 자동 공유
  readerFontSize: 15,         // 본문 기본 폰트 크기 (px)
  rootOverrides: {},          // 주석 폴더를 옮겼을 때 새 경로 (source id → 경로)
  dataRepo: 'hyod9866/sermon-commentary-data', // 장 단위 주석 데이터 원격 저장소
  dataBranch: 'main',
  externalDataDir: 'C:\\Users\\D-kanghyodgeun\\Documents\\KHG_build\\commentary_data', // 보관함 외부 대용량 데이터 경로 (Obsidian Sync 제외)
  chapterHashes: {},
  installedPacks: {},         // 선택 설치한 주석 팩 상태 ({ [sid]: { hash, zipBytes, fileCount, installedAt, storage } })
  installedPacksOnly: false,  // true면 설치한 주석 팩만 사용 (미설치 주석의 GitHub 자동 조회 끄기)
};

const PACK_DEFS = [
  { id: 'bible-dict', name: '성경대사전', desc: '성경 인물·지명·신학 용어 백과사전' },
  { id: 'mackintosh', name: '매킨토시 모세오경 강해', desc: '창세기~신명기 C.H.M. 강해 전집 (5권)' },
  { id: 'hokma', name: '호크마 종합주석', desc: '창세기~요한계시록 66권 전체' },
  { id: 'matthew', name: '매튜 헨리 주석', desc: '창세기~요한계시록 66권 전체' },
  { id: 'spurgeon_psalms', name: '스펄전 시편 보화', desc: '시편 1~150편 (다윗의 보고)' },
  { id: 'spurgeon', name: '스펄전 설교 전집', desc: '창세기~요한계시록 성경구절 색인 설교' },
  { id: 'grand', name: '그랜드 종합주석 (대용량)', desc: '창세기~요한계시록 66권 (압축 약 152 MB · 매일 복원본 반영)' },
];
const PACKABLE_COMMENTARY_IDS = new Set(['hokma', 'matthew', 'mackintosh', 'grand', 'spurgeon_psalms', 'spurgeon']);

function formatBytesMb(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '-';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function parseZipCentralDirectory(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocdOffset = -1;
  const minOff = Math.max(0, u8.length - 65558);
  for (let i = u8.length - 22; i >= minOff; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('유효한 ZIP 파일이 아닙니다 (EOCD 없음).');
  const totalEntries = dv.getUint16(eocdOffset + 10, true);
  const cdOffset = dv.getUint32(eocdOffset + 16, true);
  const dec = new TextDecoder('utf-8');
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) {
      throw new Error('ZIP 중앙 디렉터리 손상');
    }
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localHeaderOffset = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compSize, uncompSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function extractZipEntryBytes(u8, entry) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const lh = entry.localHeaderOffset;
  if (lh + 30 > u8.length || dv.getUint32(lh, true) !== 0x04034b50) {
    throw new Error(`ZIP 로컬 헤더 손상: ${entry.name}`);
  }
  const lfNameLen = dv.getUint16(lh + 26, true);
  const lfExtraLen = dv.getUint16(lh + 28, true);
  const dataStart = lh + 30 + lfNameLen + lfExtraLen;
  const compSlice = u8.subarray(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) {
    return new Uint8Array(compSlice);
  }
  if (entry.method !== 8) {
    throw new Error(`지원하지 않는 ZIP 압축 방식(${entry.method}): ${entry.name}`);
  }
  if (typeof require === 'function') {
    try {
      const zlib = require('zlib');
      if (zlib && typeof zlib.inflateRawSync === 'function') {
        const out = zlib.inflateRawSync(compSlice);
        return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
      }
    } catch (e) {
      // Node zlib 실패 시 Web DecompressionStream fallback
    }
  }
  if (typeof DecompressionStream !== 'function') {
    throw new Error('이 기기는 DEFLATE 압축 해제를 지원하지 않습니다 (iPadOS 16.4 이상 필요).');
  }
  const ds = new DecompressionStream('deflate-raw');
  const readerPromise = new Response(ds.readable).arrayBuffer();
  const writer = ds.writable.getWriter();
  await writer.write(compSlice);
  await writer.close();
  return new Uint8Array(await readerPromise);
}

/**
 * "요 3:16", "요한복음 3장 16절", "골 3 5", "골 3 5-11", "롬 8", "골" 등을 폭넓게 해석한다.
 * @returns {{b:number, ch:number, v1:number, v2:number}|null}  (v1=0이면 장 전체)
 */
function parseRef(input) {
  if (!input) return null;
  let s = String(input).replace(/[\[\](){}<>.,·:;]/g, ' ').trim();
  const raw = String(input).trim();

  // 1. 콜론 / 장 / 편 / 마침표 구분: "골 3:5", "골 3:5-11", "골 3장 5절", "골 3.5"
  let m = raw.match(/([1-3]?\s*[가-힣]{1,8}(?:\s*[1-3]서)?)\s*(\d{1,3})\s*[:：장편.]\s*(\d{1,3})?\s*절?(?:\s*[-~–]\s*(\d{1,3})\s*절?)?/);
  if (!m) {
    // 2. 공백 구분 2개 숫자: "골 3 5", "골 3 5-11"
    m = raw.match(/([1-3]?\s*[가-힣]{1,8}(?:\s*[1-3]서)?)\s*(\d{1,3})\s+(\d{1,3})\s*절?(?:\s*[-~–]\s*(\d{1,3})\s*절?)?/);
  }
  if (!m) {
    // 3. 단일 장 숫자: "골 3", "골 3장", "시 23편"
    m = raw.match(/([1-3]?\s*[가-힣]{1,8}(?:\s*[1-3]서)?)\s*(\d{1,3})\s*(?:[장편])?/);
  }
  if (!m) {
    // 4. 책 이름만 입력된 경우: "골", "골로새서"
    m = raw.match(/([1-3]?\s*[가-힣]{1,8}(?:\s*[1-3]서)?)/);
  }
  if (!m) return null;

  const bookRaw = m[1].replace(/\s+/g, '');
  let no = null;
  for (const [k, n] of BOOK_KEYS) {
    if (bookRaw === k || (bookRaw.endsWith(k) && bookRaw.length - k.length <= 0)) { no = n; break; }
  }
  if (!no) {
    for (const [k, n] of BOOK_KEYS) {
      if (k.length >= 2 && bookRaw.startsWith(k)) { no = n; break; }
    }
  }
  if (!no) return null;

  const ch = m[2] ? parseInt(m[2], 10) : 0;
  const v1 = m[3] ? parseInt(m[3], 10) : 0;
  let v2 = m[4] ? parseInt(m[4], 10) : v1;
  if (v2 < v1) v2 = v1;
  return { b: no, ch, v1, v2 };
}

/**
 * 쉼표(,)로 연결된 복수 구절(예: "대상 15:16,27", "대하 5:12,13", "대상 6:33,15:17")을 세그먼트 배열로 파싱합니다.
 */
function parseMultiRef(input) {
  if (!input) return null;
  let clean = String(input).trim().replace(/(\d+)\s*[:：]\s*(\d+)\s+(\d+)/g, '$1:$2$3').replace(/(\d+)\s+(\d+)/g, '$1$2');

  const m = clean.match(/^([1-3]?\s*[가-힣]{1,8}(?:\s*[1-3]서)?)\s*(\d{1,3})\s*[:：장편.]\s*(\d{1,3})?(?:\s*[-~–]\s*(\d{1,3}))?(.*)$/);
  if (!m) {
    const single = parseRef(clean);
    if (!single) return null;
    const bk = BOOK_SHORT[single.b] || BOOK_NAME[single.b] || '';
    return {
      b: single.b,
      bookRaw: bk,
      segments: [{ ch: single.ch, v1: single.v1, v2: single.v2 }],
      label: refLabel(single)
    };
  }

  const bookRaw = m[1].replace(/\s+/g, '');
  let b = null;
  for (const [k, n] of BOOK_KEYS) {
    if (bookRaw === k || (bookRaw.endsWith(k) && bookRaw.length - k.length <= 0)) { b = n; break; }
  }
  if (!b) {
    for (const [k, n] of BOOK_KEYS) {
      if (k.length >= 2 && bookRaw.startsWith(k)) { b = n; break; }
    }
  }
  if (!b) return null;

  let currentCh = parseInt(m[2], 10);
  let v1 = m[3] ? parseInt(m[3], 10) : 0;
  let v2 = m[4] ? parseInt(m[4], 10) : v1;
  if (v2 < v1) v2 = v1;
  const segments = [{ ch: currentCh, v1, v2 }];

  const rest = m[5];
  if (rest) {
    const parts = rest.split(/\s*,\s*/);
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      const chVMatch = p.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-~–]\s*(\d{1,3}))?/);
      if (chVMatch) {
        currentCh = parseInt(chVMatch[1], 10);
        const pv1 = parseInt(chVMatch[2], 10);
        let pv2 = chVMatch[3] ? parseInt(chVMatch[3], 10) : pv1;
        if (pv2 < pv1) pv2 = pv1;
        segments.push({ ch: currentCh, v1: pv1, v2: pv2 });
      } else {
        const vMatch = p.match(/^(\d{1,3})(?:\s*[-~–]\s*(\d{1,3}))?/);
        if (vMatch) {
          const pv1 = parseInt(vMatch[1], 10);
          let pv2 = vMatch[2] ? parseInt(vMatch[2], 10) : pv1;
          if (pv2 < pv1) pv2 = pv1;
          segments.push({ ch: currentCh, v1: pv1, v2: pv2 });
        }
      }
    }
  }

  const shortBook = BOOK_SHORT[b] || bookRaw;
  const segLabels = [];
  let lastCh = -1;
  for (const s of segments) {
    const vStr = s.v1 === s.v2 ? `${s.v1}` : `${s.v1}-${s.v2}`;
    if (s.ch !== lastCh) {
      segLabels.push(`${s.ch}:${vStr}`);
      lastCh = s.ch;
    } else {
      segLabels.push(`${vStr}`);
    }
  }
  const label = `${shortBook} ${segLabels.join(', ')}`;
  return { b, bookRaw: shortBook, segments, label };
}

/**
 * 주어진 책 색인 항목들 중 검색한 장절(r)과 가장 정확하게 부합하는 항목을 점수제로 선별합니다.
 */
function findBestEntry(bookEntries, r, idx) {
  if (!bookEntries || !bookEntries.length) return null;
  let best = null;
  let bestScore = -999999;

  for (const e of bookEntries) {
    const [b, e_ch, e_v1, e_v2, fi] = e;
    const isHokma = idx.files[fi] && idx.files[fi][0] === 'hokma';
    const isMatthew = idx.files[fi] && idx.files[fi][0] === 'matthew';
    const isSpurgeon = idx.files[fi] && idx.files[fi][0] === 'spurgeon';
    const isSpurgeonPs = idx.files[fi] && idx.files[fi][0] === 'spurgeon_psalms';
    const isMackintosh = idx.files[fi] && idx.files[fi][0] === 'mackintosh';
    const isGrand = idx.files[fi] && idx.files[fi][0] === 'grand';
    let score = 0;

    if (r.ch === 0) {
      // 사용자가 책 전체 또는 서론을 검색한 경우 (예: 로마서, 골로새서)
      if (e_ch === 0) {
        score += 8000;
        const e_kind = e[7];
        if (e_kind === 7) score += 3000; // 서론 최우선
      } else if (e_ch === 1 && e_v1 === 0) {
        score += 1000; // 차선책: 1장 개관
      }
    } else if (e_ch === r.ch) {
      score += 1000;
      if (r.v1 > 0) {
        // 사용자가 절(v1 > 0)을 입력한 경우
        if (e_v1 > 0 && e_v1 <= r.v2 && e_v2 >= r.v1) {
          score += 5000;
          if (e_v1 === r.v1) score += 2000; // 시작절 정확 일치
          const span = Math.max(1, e_v2 - e_v1 + 1);
          score += Math.max(0, 500 - span * 20); // 구체적 소범위 절 우선
          if (e[7] === 1) score += 100; // 강해주석 최우선 가중치
        } else if (e_v1 === 0) {
          score += 100; // 장 개관
        }
      } else {
        // 사용자가 장 단위(v1 == 0, 예: 골 3장, 시 138편)를 입력한 경우
        if (e_v1 === 0) {
          score += 5000; // 장 개관 최우선
          if (e[7] === 0) score += 500; // 개관 kind 가중치
        } else {
          score += Math.max(0, 2000 - e_v1); // 장의 앞선 절 우선
        }
      }
    }

    if (isHokma) score += 300; // 호크마 정본 디지털 주석 최우선 가중치
    else if (isMatthew) score += 200; // 매튜헨리 주석 차선 가중치
    else if (isSpurgeonPs) score += 190; // 스펄전 시편강해 가중치
    else if (isMackintosh) score += 180; // 매킨토시 모세오경 가중치
    else if (isSpurgeon) score += 150; // 스펄전 설교전집 가중치
    else if (isGrand) score += 50; // 그랜드종합주석 기본 가중치

    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best || bookEntries[0];
}

function getBookDisplayName(b, plugin) {
  if (!b) return '';
  const opt = plugin?.settings?.bookNameFormat || 'auto';
  if (opt === 'short') return BOOK_SHORT[b] || BOOK_NAME[b];
  if (opt === 'full') return BOOK_NAME[b];
  // auto: 성경 찾기(Bible Finder)의 koreanBookFormat 설정 동기화
  try {
    const bf = plugin?.app?.plugins?.plugins?.['obsidian-bible-finder'];
    if (bf?.settings?.koreanBookFormat === 'full') {
      return BOOK_NAME[b];
    }
  } catch (e) {}
  // 기본값: 역본 대조 및 스트롱 코드와 일치하는 약어(short)
  return BOOK_SHORT[b] || BOOK_NAME[b];
}

function refLabel(r, plugin) {
  if (!r) return '';
  const unit = r.b === 19 ? '편' : '장';
  const bName = getBookDisplayName(r.b, plugin);
  if (r.ch === 0) return `${bName} 서론`;
  if (!r.v1) return `${bName} ${r.ch}${unit}`;
  return `${bName} ${r.ch}:${r.v1}${r.v2 && r.v2 !== r.v1 ? '-' + r.v2 : ''}`;
}

function cleanSnippet(s) {
  if (!s) return '';
  const hangul = (s.match(/[가-힣]/g) || []).length;
  if (hangul < s.length * 0.35) return '';
  return s;
}

function getEntryStorageKey(e) {
  if (!e) return '';
  return `${e[4]}_${e[5]}_${e[6]}_${e[7]}`;
}

function getEntryDomKey(e) {
  if (!e) return '';
  const base = getEntryStorageKey(e);
  return e._isGrandVerseSub ? `${base}_v${e[2]}_${e[3]}` : base;
}

function getEntryCorrected(e, bookData) {
  if (!e || !bookData || !bookData.corrected) return '';
  const domKey = getEntryStorageKey(e);
  if (bookData.corrected[domKey]) return bookData.corrected[domKey];
  const legacyKey = `${e[4]}_${e[5]}_${e[6]}`;
  return bookData.corrected[legacyKey] || '';
}

function extractGrandVerseEntries(e, bookData, idx) {
  if (!e || !bookData) return null;
  const [b, ch, v1, , fi, p1, p2, ki] = e;
  if (ch <= 0 || v1 > 0 || ki !== 1) return null;
  if (!idx.files[fi] || idx.files[fi][0] !== 'grand') return null;

  let rawText = getEntryCorrected(e, bookData);
  if (!rawText && bookData.pages) {
    const chunks = [];
    for (let p = p1; p <= p2; p++) {
      const k = `${fi}_${p}`;
      if (bookData.pages[k]) chunks.push(bookData.pages[k]);
    }
    rawText = chunks.join('\n');
  }
  if (!rawText) return null;

  const seen = new Set();
  const subs = [];
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const verseHeadRes = [
    /^\*\*(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-~]\s*(\d{1,3}))?(?:\s+([^*]+?))?\*\*/,
    /^<div\s+class=["']scf-verse-head["']>\s*(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-~]\s*(\d{1,3}))?(?:\s+([^<]+?))?\s*<\/div>/i,
    /^####\s*[•●]?\s*(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-~]\s*(\d{1,3}))?(?:\s*[—\-–]?\s*\*\*([^*]+)\*\*)?/,
    /^[•●]?\s*(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-~]\s*(\d{1,3}))?\s+([가-힣A-Za-z‘"'(][^\n]{1,40}[.·])/,
  ];

  for (const rawLine of lines) {
    const t = rawLine.trim();
    if (!t || /^:::box/i.test(t) || /^>/.test(t)) continue;
    let m = null;
    for (const re of verseHeadRes) {
      m = t.match(re);
      if (m) break;
    }
    if (!m) continue;
    const mc = parseInt(m[1], 10);
    if (mc !== ch) continue;
    const mv1 = parseInt(m[2], 10);
    let mv2 = m[3] ? parseInt(m[3], 10) : mv1;
    if (mv2 < mv1) mv2 = mv1;
    if (mv1 <= 0 || mv1 > 176) continue;
    const key = `${mv1}-${mv2}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const headPhrase = (m[4] || '').replace(/\*\*/g, '').trim();
    const sub = [b, ch, mv1, mv2, fi, p1, p2, ki, headPhrase || `${ch}:${mv1}`];
    sub._isGrandVerseSub = true;
    sub._parentEntry = e;
    subs.push(sub);
  }

  return subs.length >= 2 ? subs : null;
}

/**
 * 매킨토시 모세오경 주석 DOM 후처리:
 * 단행본처럼 독립 성경 구절 단락과 본문 내 성경 인용구("..."(창 1:1) 등)에 고딕 강조 클래스를 부여합니다.
 */
function formatMackintoshDOM(targetContainer) {
  if (!targetContainer) return;
  targetContainer.classList.add('scf-mack-article');

  targetContainer.querySelectorAll('p').forEach((p) => {
    const raw = (p.textContent || '').trim();
    if (!raw) return;
    if (/^제\s*\d+(?:\s*[-~–]\s*\d+)?\s*장(?:\s*\([^)]+\))?$/.test(raw)) {
      p.classList.add('scf-mack-sub-head');
      return;
    }
    const soloQ = raw.match(/^([“"])([^”"\n]{4,})([”"])(?:\s*[\(\[][^)\]]{1,40}[\)\]])?[.。]?$/);
    if (soloQ && !/[”"]/.test(soloQ[2])) {
      p.classList.add('scf-mack-bible-quote');
    }
  });

  const walker = document.createTreeWalker(targetContainer, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.closest('h1, h2, h3, h4, code, pre, a, button, strong, .scf-mack-bible-quote, .scf-mack-sub-head, .scf-mack-gothic, .scf-ref-link, .scf-dict-verse-link')) continue;
    if (!parent.closest('p, li, blockquote')) continue;
    if (node.nodeValue && /[“"]/.test(node.nodeValue)) {
      textNodes.push(node);
    }
  }

  const quoteRe = /([“"])([^”"\n]{1,450})([”"])(\s*[\(\[][^)\]]{1,40}[\)\]])?/g;
  for (const tNode of textNodes) {
    const text = tNode.nodeValue;
    quoteRe.lastIndex = 0;
    let lastIdx = 0;
    let m;
    const frag = document.createDocumentFragment();
    let changed = false;

    while ((m = quoteRe.exec(text)) !== null) {
      const inner = m[2] || '';
      const citeTail = m[4] || '';
      const hasBibleCite = /(?:\d+\s*[:：]\s*\d+|\d+\s*절|장)/.test(citeTail);
      if (!hasBibleCite && inner.trim().length < 10) continue;

      if (m.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
      }
      const span = document.createElement('span');
      span.className = 'scf-mack-gothic';
      span.textContent = m[0];
      frag.appendChild(span);
      lastIdx = m.index + m[0].length;
      changed = true;
    }

    if (changed) {
      if (lastIdx < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      }
      tNode.parentNode.replaceChild(frag, tNode);
    }
  }
}

/**
 * 주석 본문 내 성경 장절 표기((창세기 1:16), (시 19:1), (1절) 등)를 클릭 가능한 링크로 변환합니다.
 */
function linkifyVerseRefsInDOM(targetContainer, plugin, ctxBook = 0, ctxCh = 0) {
  if (!targetContainer || !plugin) return;

  const collectTextNodes = () => {
    const walker = document.createTreeWalker(targetContainer, NodeFilter.SHOW_TEXT, null);
    const list = [];
    let n;
    while ((n = walker.nextNode())) {
      const p = n.parentElement;
      if (!p) continue;
      if (p.closest('a, button, code, pre, h1, h2, h3, h4, .scf-ref-link, .scf-dict-verse-link, .scf-chapter-hero-title, .scf-mack-ch-head, .scf-mack-sub-head, .scf-verse-head, .scf-crossref-cit, .scf-passage-title')) continue;
      if (n.nodeValue && /\d/.test(n.nodeValue)) list.push(n);
    }
    return list;
  };

  // Pass 1: 책 이름 + 장:절 표기 (예: 창세기 1:16, 시편 19:1, 히브리서 5:4, 사도행전 20장 7절)
  const explicitRe = /([1-3]?\s*[가-힣]{1,8}(?:\s*[1-3]서)?\s*\d{1,3}\s*[:：장편.]\s*\d{1,3}(?:\s*[-~–]\s*\d{1,3})?(?:\s*,\s*(?:\d{1,3}\s*[:：]\s*)?\d{1,3}(?:\s*[-~–]\s*\d{1,3})?)*(?:\s*절)?)/g;
  for (const tNode of collectTextNodes()) {
    const text = tNode.nodeValue;
    explicitRe.lastIndex = 0;
    let lastIdx = 0;
    let m;
    const frag = document.createDocumentFragment();
    let changed = false;

    while ((m = explicitRe.exec(text)) !== null) {
      const refStr = m[1];
      const parsed = parseMultiRef(refStr) || parseRef(refStr);
      const firstSeg = parsed?.segments?.[0];
      const chNum = firstSeg ? firstSeg.ch : parsed?.ch;
      const vNum = firstSeg ? firstSeg.v1 : parsed?.v1;
      if (!parsed || !parsed.b || !chNum || !vNum) continue;

      if (m.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
      }
      const link = document.createElement('span');
      link.className = 'scf-dict-verse-link';
      link.textContent = refStr;
      link.title = `클릭 시 성경 본문 보기: ${parsed.label || refStr}`;
      link.onclick = async (evt) => {
        evt.stopPropagation();
        await plugin.showVersePopover(refStr, link);
      };
      frag.appendChild(link);
      lastIdx = m.index + m[0].length;
      changed = true;
    }

    if (changed) {
      if (lastIdx < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      }
      tNode.parentNode.replaceChild(frag, tNode);
    }
  }

  // Pass 2: 현재 장 문맥 내 괄호 절 표기 (예: (1절), (7-10절))
  if (ctxBook > 0 && ctxCh > 0 && BOOK_SHORT[ctxBook]) {
    const shortBk = BOOK_SHORT[ctxBook];
    const relRe = /\((\d{1,3}(?:\s*[-~–]\s*\d{1,3})?\s*절)\)/g;
    for (const tNode of collectTextNodes()) {
      const text = tNode.nodeValue;
      relRe.lastIndex = 0;
      let lastIdx = 0;
      let m;
      const frag = document.createDocumentFragment();
      let changed = false;

      while ((m = relRe.exec(text)) !== null) {
        const inner = m[1];
        const vRange = inner.replace(/\s*절$/, '').replace(/\s+/g, '');
        const v1 = parseInt(vRange.split(/[-~–]/)[0], 10);
        if (!v1 || v1 < 1 || v1 > 176) continue;

        const targetRef = `${shortBk} ${ctxCh}:${vRange}`;
        if (m.index > lastIdx) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
        }
        frag.appendChild(document.createTextNode('('));
        const link = document.createElement('span');
        link.className = 'scf-dict-verse-link';
        link.textContent = inner;
        link.title = `클릭 시 성경 본문 보기: ${targetRef}`;
        link.onclick = async (evt) => {
          evt.stopPropagation();
          await plugin.showVersePopover(targetRef, link);
        };
        frag.appendChild(link);
        frag.appendChild(document.createTextNode(')'));
        lastIdx = m.index + m[0].length;
        changed = true;
      }

      if (changed) {
        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        }
        tNode.parentNode.replaceChild(frag, tNode);
      }
    }
  }
}

function formatEntryLabel(e, idx, plugin, includeTag = false) {
  if (!e) return '';
  const [b, ch, v1, v2, , , , ki] = e;
  const kind = idx.kinds[ki] || (v1 === 0 ? '장 개관' : '');
  const bName = getBookDisplayName(b, plugin);
  const unit = b === 19 ? '편' : '장';
  let label = '';
  if (ch === 0) {
    if (kind === '참고문헌') label = `${bName} 참고문헌`;
    else if (kind === '개요') label = `${bName} 개요`;
    else if (kind === '특별자료') label = `${bName} 서론 특별자료`;
    else label = `${bName} 서론`;
  } else if (v1 === 0 && (kind === '본문&자료노트' || kind === '강해주석' || kind === '연구자료')) {
    label = `${bName} ${ch}${unit} ${kind}`;
  } else if (v1 === 0) {
    if (kind === '설교') label = `${bName} ${ch}${unit} 주제, 원어&교리설교`;
    else if (kind === '핵심성구관주') label = `${bName} ${ch}${unit} 핵심성구관주`;
    else if (kind === '예화') label = `${bName} ${ch}${unit} 예화`;
    else if (kind === 'QT제목' || kind === 'Q·T 제목') label = `${bName} ${ch}${unit} Q·T 제목`;
    else if (kind === '금언') label = `${bName} ${ch}${unit} 금언`;
    else {
      const kStr = (kind === '장 개관' || kind === '개관') ? '개관' : (kind || '개관');
      label = `${bName} ${ch}${unit} ${kStr}`;
    }
  } else {
    label = `${bName} ${ch}:${v1 === v2 ? v1 : `${v1}-${v2}`}`;
  }
  if (includeTag && kind && !label.includes(kind) && kind !== '장 개관' && kind !== '개관') {
    return `${label} (${kind})`;
  }
  return label;
}

function isStructuredGrandMarkdown(text) {
  if (!text) return false;
  return /(?:^|\n)#{1,4}\s+/.test(text)
    || /(?:^|\n):::(?:box|box-cont|meta)\b/.test(text)
    || /【(?:도표|보감|원어연구|인물연구|주요주제|신학용어|고고학|배경|지명연구|특강|구속사적\s*개관)】/.test(text);
}

function applyCrossRefLinksSafe(htmlOrMd) {
  const refRe = /([1-3]?[가-힣]{1,8}\s*\d{1,3}(?:장|편)?(?:\s*[:：]\s*\d{1,3}(?:[-~]\d{1,3})?)?)\s*(?:장\s*|편\s*)?(?:자료노트|연구자료|주석)?\s*(?:를\s*)?참조(?:\s*하라)?/g;
  return htmlOrMd.split(/(<[^>]+>)/g).map((seg, idx) => {
    if (idx % 2 === 1) return seg;
    return seg.replace(refRe, (match, p1) => {
      const cleanRef = p1.replace(/\s+/g, ' ').trim();
      return `<span class="scf-ref-link" data-ref="${cleanRef}">🔗 ${match}</span>`;
    });
  }).join('');
}

function formatStructuredGrandText(text) {
  let res = text;
  // 0. 관주 등 본문 내 <한글> 꺾쇠가 HTML 태그로 삼켜지지 않도록 전각 〈한글〉로 정규화 & 테이블 중복 태그 정리
  res = res.replace(/<([가-힣][^>\n<]{0,24})>/g, '〈$1〉');
  res = res.replace(/<\/tbody>\s*<\/tbody>/gi, '</tbody>');
  // 잘못 H4로 묶인 강해주석 절 표제 복구
  res = res.replace(
    /^####\s*[•●]?\s*(\d{1,3})\s*[:：]\s*(\d{1,3}(?:\s*[-~]\s*\d{1,3})?)\s*[—\-–]?\s*\*\*([^*]+)\*\*[ \t]*(.*)$/gm,
    (_, c, v, head, rest) => `**${c}:${v.replace(/\s+/g, '')} ${head.trim()}**${rest ? ' ' + rest.trim() : ''}`
  );

  // 1. 장 대제목 Hero (제N장 제목 및 서론 대제목 통일)
  res = res.replace(/(?:^|\n)#\s*제\s*(\d{1,3})\s*([장편])\s+([^\n]+)/i, (m, chNum, chUnit, chTitle) => {
    const cleanTitle = chTitle.replace(/\s+/g, ' ').trim();
    return `\n\n<div class="scf-chapter-hero-title">\n  <div class="scf-chapter-badge">제 ${chNum} ${chUnit}</div>\n  <div class="scf-chapter-name">${cleanTitle}</div>\n</div>\n\n`;
  });
  res = res.replace(/(?:^|\n)#\s+([^\n]*서론[^\n]*)/i, (m, introTitle) => {
    const cleanTitle = introTitle.replace(/\s+/g, ' ').trim();
    return `\n\n<div class="scf-chapter-hero-title">\n  <div class="scf-chapter-badge">서 론</div>\n  <div class="scf-chapter-name">${cleanTitle}</div>\n</div>\n\n`;
  });

  // 2. 구속사적 개관 도입 배지
  res = res.replace(/(?:\*\*)?【\s*구속사적\s*개관\s*】(?:\*\*)?\s*[:：]?/g, '<span class="scf-pill-intro">구속사적 개관</span> ');

  // 3. 설교·예화 메타 바 (구분 | 본문 | 찬송 / 성구 칩 분리)
  res = res.replace(/(?:^|\n):::meta\s+([^\n]+?)\s*:::/g, (m, meta) => {
    const parts = meta.split('|').map(s => s.trim()).filter(Boolean);
    const chips = parts.map(p => {
      const idxColon = p.search(/[:：]/);
      if (idxColon > 0) {
        const k = p.slice(0, idxColon).trim();
        const v = p.slice(idxColon + 1).trim();
        return `<span class="scf-meta-chip"><span class="scf-meta-k">${k}</span><span class="scf-meta-v">${v}</span></span>`;
      }
      return `<span class="scf-meta-chip"><span class="scf-meta-v">${p}</span></span>`;
    }).join('');
    return `\n\n<div class="scf-sermon-meta">${chips}</div>\n\n`;
  });

  // 4. 강해주석 단락 해설 박스 (:::box ... :::)
  res = res.replace(/(?:^|\n):::box(?:-cont)?(?:[ \t]+([^\n]*))?\n([\s\S]*?)\n:::/g, (m, title, body) => {
    const cleanTitle = (title || '단락 해설').trim();
    const cleanBody = body.trim();
    return `\n\n<div class="scf-passage-box">\n  <div class="scf-passage-title">📌 ${cleanTitle}</div>\n  <div class="scf-passage-body">\n\n${cleanBody}\n\n</div>\n</div>\n\n`;
  });

  // 5. 검은 음영 반전 배지 헤더 (단독 행은 일체형 블록 헤더로, 인라인은 뱃지로)
  res = res.replace(/^(?:\*\*)?【\s*(도표|보감|원어연구|인물연구|주요주제|신학용어|고고학|배경|지명연구|특강)\s*】([^\n]*)$/gm, (m, tag, tail) => {
    const t = tail.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().replace(/^[-–—:]\s*/, '');
    return t
      ? `<div class="scf-badge-head"><span class="scf-pill-black">${tag}</span><span class="scf-badge-title">${t}</span></div>`
      : `<div class="scf-badge-head"><span class="scf-pill-black">${tag}</span></div>`;
  });
  res = res.replace(/(?:\*\*)?【\s*(도표|보감|원어연구|인물연구|주요주제|신학용어|고고학|배경|지명연구|특강)\s*】([^*<\n]*)(?:\*\*)?/g, (m, tag, tail) => {
    const t = tail.trim().replace(/^[-–—:]\s*/, '');
    return t ? `<span class="scf-pill-black">${tag}</span> **${t}**` : `<span class="scf-pill-black">${tag}</span>`;
  });

  // 6. 핵심 성구 관주 2열 정렬 행 (`신 4:29  그러나 네가...`) & 강조 키워드 `〈...〉`
  if (/##\s*핵심\s*성구\s*관주/.test(res)) {
    res = res.replace(
      /^((?:창|출|레|민|신|수|삿|룻|삼[상하]|왕[상하]|대상|대하|스|느|에|욥|시|잠|전|아|사|렘|애|겔|단|호|욜|암|옵|욘|미|나|합|습|학|슥|말|마|막|눅|요(?:일|이|삼|[123])?|행|롬|고[전후]|갈|엡|빌|골|살[전후]|딤[전후]|딛|몬|히|약|벧[전후]|유|계)\s*\d{1,3}\s*[:：]\s*\d{1,3}(?:\s*[-~,]\s*\d{1,3})?)\s+([^\n]+)$/gm,
      (m, cit, body) => {
        const cleanCit = cit.replace(/\s*[:：]\s*/g, ':').replace(/\s+/g, ' ').trim();
        const highlighted = body.replace(/〈([^〉]+)〉/g, '<span class="scf-crossref-kw">〈$1〉</span>');
        return `<div class="scf-crossref-row"><span class="scf-crossref-cit">${cleanCit}</span><span class="scf-crossref-body">${highlighted}</span></div>`;
      }
    );
  }

  // 7. Q·T 제목 각 절 배지 (`**18:3** ...`) 및 참고구절 (`● 고전 4:12 ...`) + 금언 (`● ... (출전)`)
  if (/##\s*Q\s*[·.\-]?\s*T\s*제목/i.test(res)) {
    res = res.replace(/(?:^|\n)\*\*(\d{1,3}\s*[:：]\s*[\d,\s\-~]+)\*\*[ \t]+([^\n]+)/g, (m, ref, body) => {
      return `\n<div class="scf-qt-item"><span class="scf-qt-badge">${ref.replace(/\s*[:：]\s*/g, ':').trim()}</span><span class="scf-qt-body">${body}</span></div>`;
    });
    res = res.replace(/(?:^|\n)●\s*([^\n]+)/g, (m, refs) => `\n<div class="scf-qt-refs">● ${refs.trim()}</div>`);
  }
  if (/##\s*금\s*언/.test(res)) {
    res = res.replace(/(?:^|\n)●\s*([^\n]+?)\s*(\([^()\n]{2,40}\))\s*$/gm, (m, quote, src) => {
      return `\n<div class="scf-maxim-row"><span class="scf-maxim-bullet">●</span><span class="scf-maxim-quote">${quote.trim()}</span><span class="scf-maxim-src">${src}</span></div>`;
    });
  }

  // 8. 강해주석 절 시작 고딕 볼드 표제 (**18:1 바울이 아덴을 떠나.** / **18:25 일찍 주의 도를…가르치나.**)
  res = res.replace(/(?:^|\n)\*\*(\d{1,3}\s*[:：]\s*\d{1,3}(?:\s*[-~]\s*\d{1,3})?\s+[^\s*][^*\n]*?)\*\*[ \t]*/g, (m, heading) => {
    const cleanH = heading.replace(/\s*[:：]\s*/g, ':').trim();
    return `\n\n<div class="scf-verse-head">${cleanH}</div>\n\n`;
  });

  // 9. 상호참조 링크 (HTML 태그 속성 밖에서만 치환)
  res = applyCrossRefLinksSafe(res);
  return res.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 주석 텍스트 전처리: QoT 제목을 가독성 높은 QT 제목으로 교체하고 단락 줄바꿈을 정돈합니다.
 */
function formatCommentaryText(text) {
  if (!text) return '';
  if (isStructuredGrandMarkdown(text)) {
    return formatStructuredGrandText(text);
  }

  let res = text;

  // 0. 각 장/편의 시작 제목을 제목답게 크게 (Hero Chapter Title - PDF 원본처럼 대형 볼드 표제)
  res = res.replace(/(?:^|\n)(?:[#\s]*)(?:\[\d+쪽\]\s*)?제\s*(\d{1,3})\s*([장편])\s+([^\n]+)/i, (match, chNum, chUnit, chTitle) => {
    const cleanTitle = chTitle.replace(/\s+/g, ' ').trim();
    return `\n\n<div class="scf-chapter-hero-title">\n  <div class="scf-chapter-badge">제 ${chNum} ${chUnit}</div>\n  <div class="scf-chapter-name">${cleanTitle}</div>\n</div>\n\n`;
  });

  // 0-1. 구속사적 개관 표제 정돈 (스캔 오타 구속사척, 개판 등 통합 보정)
  res = res.replace(/(?:^|\n)[ \t]*구속사[적척쩍]?\s*개[관판]\s*[:：]/g, '\n\n**【구속사적 개관】** : ');

  // 0-2. 강해주석 단락 해설 박스 (Passage Overview Box - 원본 박스 기사 테두리 격리)
  const passPat = /(?:^|\n)([ \t]*\d{1,3}[:：]\d{1,3}\s*[-~–]\s*\d{1,3}\s+[가-힣A-Za-z0-9‘"\'\(][^\n]+)\n([\s\S]+?)(?=\n[ \t]*\d{1,3}[:：]\d{1,3}\s+[가-힣A-Za-z0-9‘"\'\(]|\n###|\n>|$)/g;
  res = res.replace(passPat, (match, heading, body) => {
    const cleanHeading = heading.trim();
    const cleanBody = body.trim();
    return `\n\n<div class="scf-passage-box">\n  <div class="scf-passage-title">📌 ${cleanHeading}</div>\n  <div class="scf-passage-body">\n\n${cleanBody}\n\n</div>\n</div>\n\n`;
  });

  // 1. QoT 제목, QoT 체목, Q-T 제목, Q'T 체목 등 1,780여 건의 OCR 오인식 변형을 'QT 제목'으로 통일하고 앞뒤 줄바꿈 부여 (4px 큰 볼드)
  res = res.replace(/Q\s*[oO0.\-'\`\"&]?\s*T\b[.\s)\`\'\"]*(?:제목|체목|쩌[|\\/\|]목|저[|\\/\|]목|제\s*목|체\s*목)/gi, '\n\n### **QT 제목**\n\n');
  // 2. '금 언'도 독립 줄바꿈 처리 및 4px 큰 볼드 헤딩
  res = res.replace(/(?:^|\n)[ \t]*금[ \t]*언[ \t]*(?:\n|$)/g, '\n\n### **금언**\n\n');
  // 3. 【성경 본문】이나 외울말씀은 품격 있는 명조체 인용구로 돋보이게 처리
  res = res.replace(/(?:^|\n)[ \t]*(?:【\s*성경\s*본문\s*】|외울\s*말씀)(.*?)(?=\n\n|\n[【\[]|$)/gs, '\n\n> [!quote] **【성경 본문】**\n> $1\n\n');
  // 4. 【박스】 또는 연구자료 / 단어사전 / 인물연구 등 박스 기사는 옵시디언 콜아웃 박스로 격리
  res = res.replace(/(?:^|\n)[ \t]*(?:【\s*(?:박스|연구자료|특강|배경|인물연구)\s*】|\[\s*(?:박스|연구자료|특강|배경|인물연구)\s*\])(.*?)(?=\n\n|\n[【\[]|$)/gs, '\n\n> [!note] $1\n\n');

  // 5. 절별 강해주석 시작 표제어 (예: 3:5 땅에 있는 지체를 죽이라.) 고딕 볼드 + 볼드 파란색 적용
  const lines = res.split('\n');
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();
    if (stripped.startsWith('>') || stripped.startsWith('#') || stripped.startsWith('<')) {
      newLines.push(line);
      continue;
    }
    const m = stripped.match(/^(\d{1,3}[:：]\d{1,3}(?:\s*[-~]\s*\d{1,3})?\s+[가-힣A-Za-z0-9‘"\'\(][^\n.·]+(?:[.\n·]|\.{3}))(.*)/);
    if (m) {
      const heading = m[1].trim();
      const rest = m[2].trim();
      if (rest) {
        newLines.push(`\n<div class="scf-verse-head">${heading}</div>\n\n${rest}`);
      } else {
        newLines.push(`\n<div class="scf-verse-head">${heading}</div>\n`);
      }
    } else {
      newLines.push(line);
    }
  }
  res = newLines.join('\n');

  // 6. 러닝 헤더 및 단순 쪽번호 제거 (스캔 잡음 제거: 예: "358", "골로새서 3 장", "강해주석 359")
  res = res.replace(/(?:^|\n)[ \t]*[0-9]{1,4}[ \t]*(?:\n|$)/g, '\n');
  res = res.replace(/(?:^|\n)[ \t]*(?:[1-3]?[가-힣]{1,8}\s*\d{1,3}\s*[장편절]?)[ \t]*(?:\n|$)/g, '\n');
  res = res.replace(/(?:^|\n)[ \t]*(?:강해[주추]석|원어대전|본문&자료노트|특별자료)\s*\d{1,4}[ \t]*(?:\n|$)/g, '\n');

  // 6-1. 성경 책 이름 및 참조 구문 OCR 오타 실시간 교정
  res = res.replace(/용\s*(\d{1,3}\s*장)/g, '욥 $1');
  res = res.replace(/녹\s*(\d{1,3}\s*장)/g, '눅 $1');
  res = res.replace(/롭\s*(\d{1,3}\s*장)/g, '롬 $1');
  res = res.replace(/엠\s*(\d{1,3}\s*장)/g, '엡 $1');
  res = res.replace(/앨\s*(\d{1,3}\s*장)/g, '엡 $1');
  res = res.replace(/힐\s*(\d{1,3}\s*장)/g, '빌 $1');
  res = res.replace(/잠조(?:\s*하라)?/g, '참조');
  res = res.replace(/개멈/g, '개념');
  res = res.replace(/성겸의/g, '성경의');
  res = res.replace(/성겸/g, '성경');
  res = res.replace(/(?:【\s*)?도\s*표(?:\s*】)?|(?:딛훤|딛뭘)/g, '<span class="scf-pill-black">도표</span>');
  res = res.replace(/(?:【\s*)?보\s*감(?:\s*】)?|(?:E웰|E텔|E훌렐|E햄)/g, '<span class="scf-pill-black">보감</span>');
  res = res.replace(/(?:【\s*)?신학\s*용어(?:\s*】)?|톨훌흡흩돼/g, '<span class="scf-pill-black">신학용어</span>');
  res = res.replace(/(?:【\s*)?원어\s*연구(?:\s*】)?|맡활훨맴/g, '<span class="scf-pill-black">원어연구</span>');

  // 7. '0000 자료노트 참조' 형태의 상호참조를 클릭 가능한 링크로 변환
  res = res.replace(/([1-3]?[가-힣]{1,8}\s*\d{1,3}(?:장)?(?:\s*[:：]\s*\d{1,3}(?:[-~]\d{1,3})?)?)\s*(?:장\s*)?(?:자료노트|연구자료|주석)?\s*(?:를\s*)?참조(?:\s*하라)?/g, (match, p1) => {
    const cleanRef = p1.replace(/\s+/g, ' ').trim();
    return `<span class="scf-ref-link" data-ref="${cleanRef}">🔗 ${match}</span>`;
  });
  // 8. 과도한 3줄 이상 빈 줄 축소
  res = res.replace(/\n{3,}/g, '\n\n');
  return res.trim();
}

/**
 * 2단 인쇄(2-column) PDF 스캔 OCR에서 행마다 잘려 있는 하드 줄바꿈을
 * 한국어 어순과 문맥에 맞춰 자연스러운 문단 단위로 스마트 병합(리플로우)합니다.
 * - 단어 중간/조사 분리 방지 (예: '하나님' + '의' -> '하나님의', '복' + '음을' -> '복음을')
 * - 영문 하이픈 분절 병합 (예: 'Hendrik-' + 'sen' -> 'Hendriksen')
 * - 스캔 페이지 번호 잔재 제거 및 화면 전체 가로폭(100%) 유려한 리플로우
 */
function unwrapCommentary(text) {
  if (!text) return '';
  if (isStructuredGrandMarkdown(text)) {
    return formatCommentaryText(text);
  }
  // 1. 방해되는 쪽 구분 태그나 단순 페이지 번호 줄 사전 정돈
  text = text.replace(/(?:^|\n)\s*\[\s*\d{1,4}\s*쪽\s*\]\s*(?=\n|$)/g, '\n');
  text = text.replace(/(?:^|\n)\s*---\s*\[페이지 구분\]\s*---\s*(?=\n|$)/g, '\n');

  const lines = text.split(/\r?\n/);
  const result = [];
  let currentPara = '';

  // 한국어 조사, 어미, 접미사 목록 (앞 줄 한글 단어와 공백 없이 붙여야 하는 패턴)
  const josaRegex = /^(?:[은는이가을를의에로와과도만며면고자들다음기서]|에서|에게|으로|보다|부터|까지|마저|조차|라는|이라|이며|이고|이나|이란|이라도|에게는|에게서|와의|과의|는데|면서|도록|하게|하여|하려|하는|할|한|된|될|되는)/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (currentPara) {
        result.push(currentPara);
        currentPara = '';
      }
      continue;
    }

    // 새 줄/문단으로 독립 보존해야 하는 항목 (장절, 절 범위 단락 제목, 목록, 섹션 제목, 번호, QT제목, 금언)
    const isPassageTitle = /^(?:[1-3]?\s*[가-힣]{1,8}\s*)?\d{1,3}\s*[:：]\s*\d{1,3}\s*[-~–]\s*\d{1,3}\s+[^\n]+$/.test(trimmed);
    const isNewSection = isPassageTitle ||
                         /^(?:[1-3]?\s*[가-힣]{1,8}\s*)?\d{1,3}\s*[:：]\s*\d{1,3}(?:\s*[-~–]\s*\d{1,3})?/.test(trimmed) ||
                         /^(?:[①-⑮㉠-㉭]|\d+[\.)]|[-*•]|\([0-9]+\)|[A-Za-z가-하][\.)])/.test(trimmed) ||
                         /^(?:외울\s*말씀|강해\s*[주추]석|원어\s*대전|본문\s*&\s*자료\s*노트|자료\s*노트|연구\s*자료|설\s*교|개\s*관|도\s*표|금\s*언|QoT|QT|Q\.T)/i.test(trimmed) ||
                         /^[0-9]{1,4}\s*$/.test(trimmed);

    if (isPassageTitle) {
      if (currentPara) {
        result.push(currentPara);
        currentPara = '';
      }
      result.push(trimmed);
      continue;
    }

    if (isNewSection) {
      if (currentPara) {
        result.push(currentPara);
        currentPara = '';
      }
      currentPara = trimmed;
      continue;
    }

    if (!currentPara) {
      currentPara = trimmed;
    } else {
      // 이전 줄이 문장 종결 부호(. ? !)로 끝나고, 다음 줄이 조사나 어미가 아니며 독립 문장 시작일 때만 문단 분리
      const endsWithPunct = /[.?!]\s*$/.test(currentPara);
      if (endsWithPunct && !josaRegex.test(trimmed) && trimmed.length > 0 && /^[A-Z가-힣0-9‘"'(]/.test(trimmed)) {
        result.push(currentPara);
        currentPara = trimmed;
      } else {
        // 단어/조사 병합
        if (/-$/.test(currentPara) && /^[a-zA-Z]/.test(trimmed)) {
          // 영문 하이픈 끝 분절
          currentPara = currentPara.slice(0, -1) + trimmed;
        } else if (/^[)\]\'\"’”,.:;!?]/.test(trimmed)) {
          // 닫는 따옴표나 문장 부호
          currentPara = currentPara + trimmed;
        } else if (/[가-힣]$/.test(currentPara) && josaRegex.test(trimmed)) {
          // 한국어 조사/어미 (공백 없이 어절 결합)
          currentPara = currentPara + trimmed;
        } else {
          // 일반 어절 공백 연결
          currentPara = currentPara + ' ' + trimmed;
        }
      }
    }
  }

  if (currentPara) result.push(currentPara);
  return formatCommentaryText(result.join('\n\n'));
}

/**
 * 부모 컨테이너(Obsidian 뷰/리프)를 전혀 건드리지 않고
 * 오직 listPanel 자체 스크롤(scrollTop)만 정확히 이동시키는 안전한 스크롤 함수
 */
function scrollPanelToItem(panel, itemEl, align = 'center') {
  if (!panel || !itemEl) return;
  try {
    const panelRect = panel.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const currentScroll = panel.scrollTop;

    // 패널 내부 좌표계 기준 아이템 위치
    const relativeItemTop = (itemRect.top - panelRect.top) + currentScroll;

    let targetOffset = relativeItemTop;
    if (align === 'center') {
      targetOffset = relativeItemTop - (panelRect.clientHeight / 2) + (itemRect.clientHeight / 2);
    } else if (align === 'nearest') {
      const topDiff = itemRect.top - panelRect.top;
      const bottomDiff = itemRect.bottom - panelRect.bottom;
      if (topDiff < 10) {
        targetOffset = currentScroll + topDiff - 20;
      } else if (bottomDiff > -10) {
        targetOffset = currentScroll + bottomDiff + 20;
      } else {
        return; // 이미 화면에 잘 보임
      }
    }
    panel.scrollTo({
      top: Math.max(0, Math.round(targetOffset)),
      behavior: 'smooth'
    });
  } catch (_) {
    try {
      const fallbackOffset = itemEl.offsetTop - (panel.clientHeight / 2) + (itemEl.clientHeight / 2);
      panel.scrollTop = Math.max(0, fallbackOffset);
    } catch (e) {}
  }
}


function setupSplitter(container, leftEl, rightEl, resizerEl, onSave, defaultPct = 30) {
  // 터치 친화적 36px 히트 영역 생성
  if (!resizerEl.querySelector('.scf-splitter-hitarea')) {
    resizerEl.createDiv({ cls: 'scf-splitter-hitarea' });
  }

  // 초기 저장 비율 복원
  if (defaultPct && defaultPct >= 15 && defaultPct <= 75) {
    leftEl.style.width = `${defaultPct}%`;
  }

  let isDragging = false;
  let startX = 0;
  let startW = 0;

  const getClientX = (e) => {
    if (e.clientX !== undefined && e.clientX !== null && e.clientX !== 0) return e.clientX;
    if (e.touches && e.touches[0]) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientX;
    return 0;
  };

  const onMove = (e) => {
    if (!isDragging) return;
    const clientX = getClientX(e);
    if (!clientX) return;
    const containerW = container.getBoundingClientRect().width;
    if (containerW < 120) return;
    const dx = clientX - startX;
    const minW = 80;
    const maxW = Math.max(minW, containerW - 100);
    const newW = Math.max(minW, Math.min(maxW, startW + dx));

    leftEl.style.setProperty('width', `${newW}px`, 'important');
    leftEl.style.setProperty('flex', 'none', 'important');
    leftEl.style.setProperty('max-width', 'none', 'important');
    rightEl.style.setProperty('flex', '1 1 0%', 'important');
    rightEl.style.setProperty('width', 'auto', 'important');

    if (e.cancelable) e.preventDefault();
  };

  const onStop = (e) => {
    if (!isDragging) return;
    isDragging = false;
    resizerEl.classList.remove('is-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onStop);
    window.removeEventListener('pointercancel', onStop);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onStop);
    window.removeEventListener('touchcancel', onStop);

    const containerW = container.getBoundingClientRect().width;
    if (containerW > 0) {
      const curW = leftEl.getBoundingClientRect().width;
      const pct = Math.max(15, Math.min(75, Math.round((curW / containerW) * 100)));
      leftEl.style.setProperty('width', `${pct}%`, 'important');
      if (typeof onSave === 'function') onSave(pct);
    }
  };

  const onStart = (e) => {
    isDragging = true;
    startX = getClientX(e);
    startW = leftEl.getBoundingClientRect().width;
    resizerEl.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onStop);
    window.addEventListener('pointercancel', onStop);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onStop);
    window.addEventListener('touchcancel', onStop);

    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };

  resizerEl.addEventListener('pointerdown', onStart);
  resizerEl.addEventListener('touchstart', onStart, { passive: false });
}

class CommentaryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.current = null;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return '주석 찾기'; }
  getIcon() { return 'library'; }

  recordLastFocused() {
    try {
      const bf = this.plugin.app.plugins?.plugins?.['obsidian-bible-finder'];
      if (bf) bf._lastFocusedBibleViewType = VIEW_TYPE;
    } catch (e) {}
  }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('scf-view');
    const savedFontSize = this.plugin.settings.readerFontSize || 15;
    root.style.setProperty('--scf-font-size', `${savedFontSize}px`);
    root.addEventListener('click', () => this.recordLastFocused());
    root.addEventListener('focusin', () => this.recordLastFocused());

    const head = root.createDiv({ cls: 'scf-head' });
    const row = head.createDiv({ cls: 'scf-row' });
    this.inputEl = row.createEl('input', { type: 'text', cls: 'scf-input', placeholder: '장절 입력 (예: 요 3:16, 룻 2장, 골 3:5)' });
    this.inputEl.style.cssText = 'background-color: #ffffff !important; background: #ffffff !important; color: #1e293b !important; border: 1.5px solid var(--background-modifier-border, #cbd5e1) !important; border-radius: 6px !important;';
    this.inputEl.setAttribute('enterkeyhint', 'search');
    this.inputEl.addEventListener('focus', () => {
      if (this.plugin) this.plugin._manualSearchLockUntil = Date.now() + 30000;
    });
    this.inputEl.addEventListener('input', () => {
      if (this.plugin) this.plugin._manualSearchLockUntil = Date.now() + 30000;
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (this.plugin) this.plugin._manualSearchLockUntil = Date.now() + 30000;
      if (e.key === 'Enter') {
        e.preventDefault();
        this.search(this.inputEl.value);
      }
    });
    this.inputEl.addEventListener('change', () => {
      if (this.plugin) this.plugin._manualSearchLockUntil = Date.now() + 30000;
      this.search(this.inputEl.value);
    });
    const btn = row.createEl('button', { cls: 'scf-btn', text: '찾기' });
    btn.onclick = () => {
      if (this.plugin) this.plugin._manualSearchLockUntil = Date.now() + 30000;
      this.search(this.inputEl.value);
    };

    const opt = head.createDiv({ cls: 'scf-opt' });
    const optLeft = opt.createDiv({ cls: 'scf-opt-left' });
    optLeft.style.cssText = 'display: inline-flex; gap: 10px; align-items: center; flex-wrap: nowrap;';

    // 1. 에디터 연동 체크박스 (설교 노트 본문 커서 실시간 동기화)
    const editorLab = optLeft.createEl('label', { cls: 'scf-follow' });
    const editorChk = editorLab.createEl('input', { type: 'checkbox' });
    editorChk.checked = !!this.plugin.settings.autoFollowEditor;
    editorLab.appendText(' 에디터 연동');
    editorLab.title = '설교 노트 본문에서 커서를 이동하거나 클릭할 때 해당 장절을 주석 검색창에 자동 검색';
    editorChk.onchange = async () => {
      this.plugin.settings.autoFollowEditor = editorChk.checked;
      await this.plugin.saveSettings();
      if (editorChk.checked) this.plugin.handleEditorCursorActivity();
    };

    // 2. 성경 찾기 검색 따라가기
    const lab = optLeft.createEl('label', { cls: 'scf-follow' });
    const chk = lab.createEl('input', { type: 'checkbox' });
    chk.checked = !!this.plugin.settings.autoFollow;
    lab.appendText(' 성경 찾기 연동');
    lab.title = '성경 찾기(역본 비교 / 스트롱)에서 검색한 장절을 주석 창도 함께 따라감';
    chk.onchange = async () => {
      this.plugin.settings.autoFollow = chk.checked;
      await this.plugin.saveSettings();
    };
    this.statusEl = opt.createSpan({ cls: 'scf-status' });

    this.resultsEl = root.createDiv({ cls: 'scf-results' });
    if (!this.plugin.index) {
      this.resultsEl.createDiv({ cls: 'scf-empty', text: '색인 파일(commentary-index.json)을 불러오지 못했습니다.' });
    } else {
      const n = this.plugin.index.entries.length;
      this.statusEl.setText(`색인 ${n.toLocaleString()}개`);
      this.resultsEl.createDiv({ cls: 'scf-empty', text: '장절을 입력하거나, 성경 찾기에서 장절을 검색하면 관련 주석 쪽이 여기에 나옵니다.' });
    }
    if (this.current) this.render(this.current);
  }

  async search(text, fromFollow = false) {
    if (fromFollow) {
      if (this.plugin && this.plugin._manualSearchLockUntil && Date.now() < this.plugin._manualSearchLockUntil) {
        return false; // 사용자의 수동 검색 및 선택 작업 보호!
      }
      const activeEl = document.activeElement;
      if (activeEl && (activeEl === this.inputEl || (typeof activeEl.closest === 'function' && (activeEl.closest('.scf-head') || activeEl.closest('.scf-list-panel') || activeEl.closest('.scf-reader-panel'))))) {
        return false;
      }
    } else {
      if (this.plugin) {
        this.plugin._manualSearchLockUntil = Date.now() + 60000;
        if (this.plugin._bookCache) {
          this.plugin._bookCache.clear();
        }
      }
    }

    const r = parseRef(text);
    if (!r) {
      if (!fromFollow) new Notice('장절을 알아보지 못했습니다. 예: 요 3:16 / 룻 2장 / 골 3:5');
      return false;
    }
    const label = refLabel(r, this.plugin);
    if (this.inputEl && this.inputEl.value !== label) this.inputEl.value = label;

    // 플러그인 전역 동기화 변수 갱신 (반복 루프 방지)
    if (this.plugin) {
      this.plugin._lastFollow = label;
      this.plugin._lastEditorFollow = label;
      if (this.plugin.loadIndex) {
        await this.plugin.loadIndex();
      }
    }

    const idx = this.plugin.index;
    if (!idx) return false;

    // 성경 찾기/에디터 자동 연동인 경우에만 동일 장절 중복 실행 방지
    const isSameRef = this.current &&
      this.current.b === r.b &&
      this.current.ch === r.ch &&
      this.current.v1 === r.v1 &&
      this.current.v2 === r.v2;

    if (fromFollow && isSameRef && (this._isRendering || (this.resultsEl && this.resultsEl.querySelector('.scf-split-container')))) {
      return true;
    }

    // 같은 책이 이미 열려 있고 동일한 장을 보고 있을 때만 좌측 목록에서 바로 찾아 선택 (다른 장 검색이나 ±2절 윈도우 재정렬 시에는 render로 새로 고침)
    const splitEl = this.resultsEl && this.resultsEl.querySelector('.scf-split-container');
    const hasVerseWindow = !!(this.resultsEl && this.resultsEl.querySelector('.scf-list-expand-btn, .scf-list-verse-wrap'));
    if (splitEl && this._selectItem && !hasVerseWindow && this.current && this.current.b === r.b && this.current.ch === r.ch && !this._showAllChapters) {
      const bookEntries = (this.plugin.bookLookup ? this.plugin.bookLookup.get(r.b) : null) || (idx.entries.filter(e => e[0] === r.b));
      const target = findBestEntry(bookEntries, r, idx);
      if (target) {
        const cardKey = getEntryDomKey(target);
        const row = this.resultsEl.querySelector(`.scf-list-item[data-card-key="${cardKey}"]`);
        if (row) {
          this.resultsEl.querySelectorAll('.scf-list-item').forEach((item) => {
            const be = item._entry;
            const hit = !!(be && r.v1 > 0 && be[1] === r.ch && be[2] > 0 && be[2] <= r.v2 && be[3] >= r.v1);
            item.classList.toggle('is-verse-match', hit);
          });
          const grp = row.closest('.scf-src-group');
          if (grp && typeof grp._setOpen === 'function') grp._setOpen(true);
          this.lastSelectedKey = cardKey;
          this.current = r;
          this._selectItem(target, row, true);
          const listPanel = this.resultsEl.querySelector('.scf-list-panel');
          setTimeout(() => {
            scrollPanelToItem(listPanel, row, 'center');
          }, 60);
          return true;
        }
      }
    }

    // 완전히 새로운 책이거나 화면이 아직 없는 경우
    this.lastSelectedKey = null;
    this.current = r;
    this.render(r);
    return true;
  }

  async render(r) {
    const el = this.resultsEl;
    if (!el) return;

    // 비동기 렌더링 충돌/중복 방지 시퀀스 발급
    this._renderSeq = (this._renderSeq || 0) + 1;
    const currentSeq = this._renderSeq;
    this._isRendering = true;

    const idx = this.plugin.index;
    if (!idx) {
      this._isRendering = false;
      return;
    }
    // 해당 책 전체 항목 (서론부터 마지막 장까지 전체 분절 항목)
    const bookEntries = (this.plugin.bookLookup ? this.plugin.bookLookup.get(r.b) : null) || (idx.entries.filter(e => e[0] === r.b));
    if (!bookEntries || !bookEntries.length) {
      this._isRendering = false;
      if (currentSeq !== this._renderSeq) return;
      el.empty();
      el.createDiv({ cls: 'scf-title', text: `📖 ${refLabel(r, this.plugin)} 주석` });
      el.createDiv({ cls: 'scf-empty', text: '이 책과 연결된 주석 색인을 찾지 못했습니다.' });
      return;
    }

    // 사용자가 찾고자 한 장절(r)과 가장 잘 맞는 항목을 점수제로 스마트 탐색
    const defaultTarget = findBestEntry(bookEntries, r, idx);

    // 해당 책/장 텍스트 데이터 비동기 로드 (장 단위 분할 파일 우선 + PC 통파일 fallback + 원격 온디맨드 자동 받기)
    let bookData = null;
    try {
      bookData = await this.plugin.loadChapterData(r.b, r.ch);
    } catch (err) {
      console.error('loadChapterData failed', err);
    }

    // 비동기 로딩 도중 다른 렌더링 요청이 들어왔다면 현재 렌더링 즉시 취소!
    if (currentSeq !== this._renderSeq) {
      return;
    }
    this._isRendering = false;

    // 비동기 로딩이 완료된 시점에 화면을 비워 중복 렌더링을 100% 원천 차단!
    el.empty();
    el.scrollTop = 0;
    el.scrollLeft = 0;
    if (this.contentEl) {
      this.contentEl.scrollTop = 0;
      this.contentEl.scrollLeft = 0;
    }
    if (this.containerEl) {
      this.containerEl.scrollTop = 0;
      this.containerEl.scrollLeft = 0;
    }

    // 전체 레이아웃: 좌측 목록 패널 + 드래그 리사이저 바(Splitter) + 우측 본문 뷰어
    const split = el.createDiv({ cls: 'scf-split-container' });
    const listPanel = split.createDiv({ cls: 'scf-list-panel' });
    const resizer = split.createDiv({ cls: 'scf-splitter' });
    resizer.createDiv({ cls: 'scf-splitter-grip' });
    const readerPanel = split.createDiv({ cls: 'scf-reader-panel' });

    setupSplitter(split, listPanel, readerPanel, resizer, (newPct) => {
      this.plugin.settings.commentarySplitPct = newPct;
      this.plugin.saveSettings();
    }, this.plugin.settings.commentarySplitPct || 30);

    const bName = getBookDisplayName(r.b, this.plugin);
    const unit = r.b === 19 ? '편' : '장';
    const isShowingAll = !!this._showAllChapters;

    // 좌측 상단 헤더: 현재 장/편 정보, 모두 접기/펼치기, 전체 보기 토글 버튼
    const listHead = listPanel.createDiv({ cls: 'scf-list-head' });
    const headTitle = isShowingAll
      ? `📖 ${bName} 전체 ${unit}`
      : (r.ch === 0 ? `📖 ${bName} 서론` : `📖 ${bName} ${r.ch}${unit}`);
    listHead.createDiv({ cls: 'scf-list-head-title', text: headTitle });

    const headActions = listHead.createDiv({ cls: 'scf-list-head-actions' });
    const groupControls = [];
    const collapseAllBtn = headActions.createEl('button', {
      cls: 'scf-mini-btn scf-collapse-all-btn',
      text: '모두 접기',
      title: '모든 주석서 목록을 한 번에 접거나 펼칩니다.'
    });
    const syncCollapseAllBtn = () => {
      const anyOpen = groupControls.some(g => g.isOpen());
      collapseAllBtn.setText(anyOpen ? '모두 접기' : '모두 펼치기');
    };
    collapseAllBtn.onclick = (ev) => {
      ev.stopPropagation();
      const anyOpen = groupControls.some(g => g.isOpen());
      for (const g of groupControls) g.setOpen(!anyOpen);
      syncCollapseAllBtn();
    };

    const toggleScopeBtn = headActions.createEl('button', {
      cls: 'scf-mini-btn scf-toggle-scope-btn',
      text: isShowingAll ? `${r.ch > 0 ? r.ch : 1}${unit}만 보기` : '전체 목록',
      title: isShowingAll ? `현재 ${unit} 항목만 집중해서 봅니다.` : `${bName} 전체 ${unit} 목록을 펼칩니다.`
    });
    toggleScopeBtn.onclick = (ev) => {
      ev.stopPropagation();
      this._showAllChapters = !this._showAllChapters;
      this.render(r);
    };

    // 상단 이전 장 내비게이션 버튼 (현재 장 집중 모드일 때 최상단 배치)
    if (!isShowingAll && r.ch > 1) {
      const prevChBtn = listPanel.createEl('button', {
        cls: 'scf-chapter-nav-btn',
        text: `⬆ 이전: ${bName} ${r.ch - 1}${unit} 보기`,
        type: 'button'
      });
      prevChBtn.onclick = (ev) => {
        ev.stopPropagation();
        this.search(`${bName} ${r.ch - 1}${unit}`);
      };
    }

    let firstEntry = null;
    let firstItemEl = null;
    let currentSelectedEntry = null;

    const selectItem = async (e, itemEl, forceReload = false) => {
      if (!e) return;
      if (!forceReload && currentSelectedEntry === e && itemEl && itemEl.classList.contains('is-active')) {
        return;
      }
      currentSelectedEntry = e;
      this.lastSelectedKey = getEntryDomKey(e);
      listPanel.querySelectorAll('.scf-list-item').forEach(el => el.classList.remove('is-active'));
      if (itemEl) {
        const grp = itemEl.closest('.scf-src-group');
        if (grp && typeof grp._setOpen === 'function') grp._setOpen(true);
        itemEl.classList.add('is-active');
        scrollPanelToItem(listPanel, itemEl, 'nearest');
      }
      try {
        const file = idx.files[e[4]];
        const sid = file ? file[0] : null;
        const sourceHits = sid ? bookEntries.filter((be) => idx.files[be[4]][0] === sid).sort((a, b) => a[5] - b[5] || a[6] - b[6] || a[1] - b[1] || a[2] - b[2]) : null;
        let entryData = bookData;
        if (!entryData || (entryData._isChapterOnly && entryData.ch !== e[1])) {
          entryData = await this.plugin.loadChapterData(e[0], e[1]);
        }
        this.renderReader(readerPanel, e, this.current || r, entryData, sourceHits, listPanel);
      } catch (err) {
        console.error('[Commentary Finder] renderReader error:', err);
        new Notice('주석 본문 로드 실패: ' + err.message);
      }
    };
    this._selectItem = selectItem;

    // listPanel 전체 이벤트 위임 (pointerdown & click)
    const handleDelegatedSelect = (evt) => {
      const itemEl = evt.target && evt.target.closest ? evt.target.closest('.scf-list-item') : null;
      if (itemEl && itemEl._entry) {
        evt.stopPropagation();
        selectItem(itemEl._entry, itemEl);
      }
    };
    listPanel.addEventListener('pointerdown', handleDelegatedSelect);
    listPanel.addEventListener('click', handleDelegatedSelect);
    listPanel.addEventListener('wheel', (ev) => {
      if (ev.deltaY !== 0) {
        listPanel.scrollTop += ev.deltaY;
      }
    }, { passive: true });

    const srcIds = Object.keys(idx.sources);
    for (const sid of srcIds) {
      let allHits = bookEntries.filter((e) => idx.files[e[4]][0] === sid);
      if (!allHits.length) continue;

      // 물리적 책 페이지(p1) 오름차순으로 완벽 정렬!
      allHits.sort((a, b) => a[5] - b[5] || a[6] - b[6] || a[1] - b[1] || a[2] - b[2]);

      if (!isShowingAll) {
        const chHits = allHits.filter(e => e[1] === r.ch);
        if (!chHits.length) continue;
        if (sid === 'grand') {
          const expandedHits = [];
          for (const chEntry of chHits) {
            const subVerses = extractGrandVerseEntries(chEntry, bookData, idx);
            if (subVerses) expandedHits.push(...subVerses);
            else expandedHits.push(chEntry);
          }
          allHits = expandedHits;
        } else {
          allHits = chHits;
        }
      }

      const group = listPanel.createDiv({ cls: 'scf-src-group' });
      const summary = group.createDiv({ cls: 'scf-src-summary' });
      const srcName = idx.sources[sid].name;
      const count = allHits.length;
      summary.setText(`▼ ${srcName} (${count})`);

      const itemsBox = group.createDiv({ cls: 'scf-src-items' });
      let isGroupOpen = true;
      const setOpen = (open) => {
        isGroupOpen = !!open;
        itemsBox.style.display = isGroupOpen ? 'flex' : 'none';
        summary.setText(`${isGroupOpen ? '▼' : '▶'} ${srcName} (${count})`);
      };
      group._setOpen = setOpen;
      groupControls.push({ isOpen: () => isGroupOpen, setOpen });
      summary.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setOpen(!isGroupOpen);
        syncCollapseAllBtn();
      });

      const createItemRow = (e, containerEl = itemsBox) => {
        const [b, ch, , , , , , ki, snip] = e;
        const kind = idx.kinds[ki] || (e[2] === 0 ? '장 개관' : '');
        const refText = formatEntryLabel(e, idx, this.plugin, false);
        const isChapter = (e[2] === 0 && (ch === 0 || kind === '장 개관' || kind === '개관'));
        const isVerseHit = !!(r && r.v1 > 0 && ch === r.ch && e[2] > 0 && e[2] <= r.v2 && e[3] >= r.v1);

        // 100% 클릭 보장을 위해 네이티브 button 태그로 생성
        const row = containerEl.createEl('button', {
          cls: 'scf-list-item' + (isChapter ? ' scf-list-item-chapter' : '') + (isVerseHit ? ' is-verse-match' : ''),
          type: 'button',
          title: e._isGrandVerseSub && snip ? snip : ''
        });
        row._entry = e;
        row.dataset.cardKey = getEntryDomKey(e);
        if (currentSelectedEntry && getEntryDomKey(currentSelectedEntry) === row.dataset.cardKey) {
          row.classList.add('is-active');
        }

        // 오직 장절(골 3:5-11 등)만 표시하고 우측에 주석 구분 배지 배치
        row.createSpan({ cls: 'scf-list-ref', text: refText });
        if (kind && !refText.includes(kind)) {
          row.createSpan({ cls: 'scf-list-kind scf-kind-' + kind.replace(/[\s&/]/g, ''), text: kind });
        }

        const handleSelect = (ev) => {
          if (ev) {
            ev.stopPropagation();
          }
          if (this.plugin) this.plugin._manualSearchLockUntil = Date.now() + 30000;
          selectItem(e, row);
        };

        row.onclick = handleSelect;
        row.addEventListener('pointerdown', (ev) => {
          ev.stopPropagation();
          selectItem(e, row);
        });
        row.addEventListener('click', handleSelect);
        row.addEventListener('touchend', (ev) => {
          ev.stopPropagation();
          selectItem(e, row);
        });
        row.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            handleSelect(ev);
          }
        });

        if (!firstEntry) {
          firstEntry = e;
          firstItemEl = row;
        }
      };

      const verseIdxs = [];
      for (let k = 0; k < allHits.length; k++) {
        if (!isShowingAll && r && r.v1 > 0 && allHits[k][1] === r.ch && allHits[k][2] > 0) {
          verseIdxs.push(k);
        }
      }

      if (!isShowingAll && r && r.v1 > 0 && verseIdxs.length > 5) {
        const firstVersePos = verseIdxs[0];
        const lastVersePos = verseIdxs[verseIdxs.length - 1];
        const preItems = allHits.slice(0, firstVersePos);
        const verseBlock = allHits.slice(firstVersePos, lastVersePos + 1);
        const postItems = allHits.slice(lastVersePos + 1);

        for (const e of preItems) createItemRow(e, itemsBox);

        // Find center index within verseBlock (exact overlap > nearest verse)
        let centerIdx = 0;
        let bestDist = Infinity;
        for (let k = 0; k < verseBlock.length; k++) {
          const ve = verseBlock[k];
          if (ve[2] <= 0) continue;
          if (ve[2] <= r.v2 && ve[3] >= r.v1) {
            const dist = Math.abs(ve[2] - r.v1) * 100 + (ve[3] - ve[2]);
            if (dist < bestDist) {
              bestDist = dist;
              centerIdx = k;
            }
          }
        }
        if (bestDist === Infinity) {
          for (let k = 0; k < verseBlock.length; k++) {
            const ve = verseBlock[k];
            if (ve[2] <= 0) continue;
            const dist = Math.abs(ve[2] - r.v1);
            if (dist < bestDist) {
              bestDist = dist;
              centerIdx = k;
            }
          }
        }

        const winStart = Math.max(0, centerIdx - 2);
        const winEnd = Math.min(verseBlock.length - 1, centerIdx + 2);
        const verseWrap = itemsBox.createDiv({ cls: 'scf-list-verse-wrap' });
        let isVerseExpanded = false;

        const renderVerseWindow = () => {
          verseWrap.empty();
          if (isVerseExpanded) {
            const collapseBtn = verseWrap.createEl('button', {
              cls: 'scf-list-expand-btn scf-list-collapse-btn',
              text: `▲ ±2절만 보기 (접기)`,
              type: 'button'
            });
            collapseBtn.onclick = (ev) => {
              ev.stopPropagation();
              isVerseExpanded = false;
              renderVerseWindow();
            };
            for (const ve of verseBlock) createItemRow(ve, verseWrap);
          } else {
            if (winStart > 0) {
              const firstV = formatEntryLabel(verseBlock[0], idx, this.plugin, false);
              const prevV = formatEntryLabel(verseBlock[winStart - 1], idx, this.plugin, false);
              const topMoreBtn = verseWrap.createEl('button', {
                cls: 'scf-list-expand-btn',
                text: `⋯ 이전 ${winStart}개 펼치기 (${firstV} ~ ${prevV})`,
                type: 'button'
              });
              topMoreBtn.onclick = (ev) => {
                ev.stopPropagation();
                isVerseExpanded = true;
                renderVerseWindow();
              };
            }
            for (let k = winStart; k <= winEnd; k++) {
              createItemRow(verseBlock[k], verseWrap);
            }
            const afterCount = verseBlock.length - 1 - winEnd;
            if (afterCount > 0) {
              const nextV = formatEntryLabel(verseBlock[winEnd + 1], idx, this.plugin, false);
              const lastV = formatEntryLabel(verseBlock[verseBlock.length - 1], idx, this.plugin, false);
              const botMoreBtn = verseWrap.createEl('button', {
                cls: 'scf-list-expand-btn',
                text: `⋯ 이후 ${afterCount}개 펼치기 (${nextV} ~ ${lastV})`,
                type: 'button'
              });
              botMoreBtn.onclick = (ev) => {
                ev.stopPropagation();
                isVerseExpanded = true;
                renderVerseWindow();
              };
            }
          }
        };

        renderVerseWindow();
        for (const e of postItems) createItemRow(e, itemsBox);
      } else {
        for (const e of allHits) {
          createItemRow(e, itemsBox);
        }
      }
    }

    // 하단 다음 장 내비게이션 버튼 (현재 장 집중 모드일 때 최하단 배치)
    if (!isShowingAll) {
      const maxCh = MAX_CHAPTERS[r.b] || 150;
      if (r.ch > 0 && r.ch < maxCh) {
        const nextChBtn = listPanel.createEl('button', {
          cls: 'scf-chapter-nav-btn scf-chapter-nav-btn-next',
          text: `⬇ 다음: ${bName} ${r.ch + 1}${unit} 보기`,
          type: 'button'
        });
        nextChBtn.onclick = (ev) => {
          ev.stopPropagation();
          this.search(`${bName} ${r.ch + 1}${unit}`);
        };
      } else if (r.ch === 0) {
        const nextChBtn = listPanel.createEl('button', {
          cls: 'scf-chapter-nav-btn scf-chapter-nav-btn-next',
          text: `⬇ 다음: ${bName} 1${unit} 보기`,
          type: 'button'
        });
        nextChBtn.onclick = (ev) => {
          ev.stopPropagation();
          this.search(`${bName} 1${unit}`);
        };
      }
    }

    // 타겟 항목 결정 (이전에 클릭한 카드 > 현재 검색 장절 최적 매칭 항목 > 첫 번째 항목)
    let targetEntry = defaultTarget || firstEntry;
    let targetEl = null;
    if (this.lastSelectedKey) {
      const matchRow = listPanel.querySelector(`.scf-list-item[data-card-key="${this.lastSelectedKey}"]`);
      if (matchRow && matchRow._entry) {
        targetEntry = matchRow._entry;
        targetEl = matchRow;
      }
    }
    if (!targetEl && targetEntry) {
      const targetCardKey = getEntryDomKey(targetEntry);
      targetEl = listPanel.querySelector(`.scf-list-item[data-card-key="${targetCardKey}"]`);
    }

    if (targetEntry && targetEl) {
      selectItem(targetEntry, targetEl);
      setTimeout(() => {
        scrollPanelToItem(listPanel, targetEl, 'center');
      }, 100);
    }
  }

  renderReader(readerPanel, e, r, bookData, allSourceEntries, listPanel) {
    this.plugin.closeVersePopover();
    readerPanel.empty();
    if (!e) return;
    const idx = this.plugin.index;
    const [b, ch, v1, v2, fi, p1, p2, ki, snip] = e;
    const file = idx.files[fi];
    const isHokma = file && file[0] === 'hokma';
    const isMatthew = file && file[0] === 'matthew';
    const isSpurgeon = file && file[0] === 'spurgeon';
    const isSpurgeonPs = file && file[0] === 'spurgeon_psalms';
    const isMackintosh = file && file[0] === 'mackintosh';
    const isDigital = isHokma || isMatthew || isSpurgeon;
    const kind = idx.kinds[ki];
    const srcName = idx.sources[file[0]]?.name || '주석';
    const bName = getBookDisplayName(b, this.plugin);
    const pr1 = e[9] || (b === 51 && fi === 50 && p1 >= 3 ? p1 + 306 : p1);
    const pr2 = e[10] || (b === 51 && fi === 50 && p2 >= 3 ? p2 + 306 : p2);
    const pgStr = isDigital ? '' : (pr2 > pr1 ? `${pr1}~${pr2}쪽` : `${pr1}쪽`);

    const refStr = formatEntryLabel(e, idx, this.plugin, false);
    const fname = file[1].split('/').pop().replace(/\.pdf$/i, '');

    // 1. 본문 데이터 준비 (다중 페이지는 문장 끊김 없이 유기적으로 연속 병합)
    const storageKey = getEntryStorageKey(e);
    const isCleanMack = isMackintosh && p1 >= 1000;
    let rawOcrText = '';
    if (bookData && bookData.pages) {
      const pgTexts = [];
      for (let p = p1; p <= p2; p++) {
        const k = `${fi}_${p}`;
        if (bookData.pages[k]) {
          pgTexts.push(bookData.pages[k]);
        }
      }
      const joined = pgTexts.join('\n');
      rawOcrText = isCleanMack ? joined.trim() : unwrapCommentary(joined);
    }
    if (!rawOcrText) rawOcrText = cleanSnippet(snip) || '';

    const correctedCandidate = getEntryCorrected(e, bookData);
    const isCorrupted = correctedCandidate && (correctedCandidate.trim().length < 20 && rawOcrText.length > 200);
    let isCorrected = !!correctedCandidate && !isCorrupted;

    let currentText = isCorrected ? (isCleanMack ? correctedCandidate.trim() : unwrapCommentary(correctedCandidate)) : rawOcrText;
    let isShowingOriginal = !isCorrected;

    // 2. 리더 상단 헤더 (사용자 요청: 중복 타이틀 행 '[호크마 종합주석] 시 138:7' 삭제하여 본문 가독성 극대화)
    const header = readerPanel.createDiv({ cls: 'scf-reader-header' });

    // 3. 툴바
    const toolbar = header.createDiv({ cls: 'scf-reader-toolbar' });

    // 돌아가기 버튼 (상호참조 링크 이동 후 이전 주석으로 복귀)
    if (this._navHistory && this._navHistory.length > 0) {
      const backBtn = toolbar.createEl('button', {
        cls: 'scf-mini-btn scf-back-btn',
        text: '⬅ 돌아가기',
        title: '이전 주석 화면으로 되돌아갑니다.'
      });
      backBtn.onclick = (evt) => {
        if (evt) evt.stopPropagation();
        const prev = this._navHistory.pop();
        if (prev) {
          if (prev.ref && (prev.ref.b !== this.current?.b || prev.ref.ch !== this.current?.ch)) {
            if (prev.entry) this.lastSelectedKey = getEntryDomKey(prev.entry);
            this.search(refLabel(prev.ref, this.plugin));
          } else if (prev.entry) {
            selectItem(prev.entry);
          }
        }
      };
    }

    // 폰트 크기 조절 컨트롤 (+ / -)
    const fontGroup = toolbar.createDiv({ cls: 'scf-font-group' });
    const fontDownBtn = fontGroup.createEl('button', {
      cls: 'scf-mini-btn scf-font-btn',
      text: 'A-',
      title: '글자 크기 축소'
    });
    const fontIndicator = fontGroup.createEl('button', {
      cls: 'scf-mini-btn scf-font-indicator',
      text: `${this.plugin.settings.readerFontSize || 15}px`,
      title: '기본 글자 크기(15px)로 초기화'
    });
    const fontUpBtn = fontGroup.createEl('button', {
      cls: 'scf-mini-btn scf-font-btn',
      text: 'A+',
      title: '글자 크기 확대'
    });

    const updateFontSize = async (newSize) => {
      newSize = Math.max(12, Math.min(26, newSize));
      this.plugin.settings.readerFontSize = newSize;
      await this.plugin.saveSettings();
      this.contentEl.style.setProperty('--scf-font-size', `${newSize}px`);
      fontIndicator.setText(`${newSize}px`);
    };

    fontDownBtn.onclick = (evt) => {
      evt.stopPropagation();
      updateFontSize((this.plugin.settings.readerFontSize || 15) - 1);
    };
    fontUpBtn.onclick = (evt) => {
      evt.stopPropagation();
      updateFontSize((this.plugin.settings.readerFontSize || 15) + 1);
    };
    fontIndicator.onclick = (evt) => {
      evt.stopPropagation();
      updateFontSize(15);
    };

    // PDF 버튼: PC/모바일 모두 제거 (사용자 요청: 의미가 없으므로 완전히 제외)

    // 편집 버튼
    const editBtn = toolbar.createEl('button', {
      cls: 'scf-mini-btn scf-edit-btn',
      text: '✏️ 편집',
      title: '오타를 직접 수정하거나 묵상 메모 작성'
    });

    // 책의 주석 항목 타이틀 헬퍼
    const getEntryTitle = (item) => formatEntryLabel(item, idx, this.plugin, true);

    // 4. 스크롤 본문 컨테이너
    const scrollContainer = readerPanel.createDiv({ cls: 'scf-reader-scroll' });

    // 상단 이전 주석 보기 버튼 (서론, 특별자료, 이전 장 등 역방향 즉시 탐색)
    const navSelf = e._parentEntry || e;
    const curIdx = allSourceEntries ? allSourceEntries.indexOf(navSelf) : -1;
    if (allSourceEntries && curIdx > 0) {
      const prevEntry = allSourceEntries[curIdx - 1];
      const prevBtn = scrollContainer.createEl('button', {
        cls: 'scf-prev-section-btn',
        text: `⬆ 이전 주석: ${getEntryTitle(prevEntry)} 보기`,
        type: 'button'
      });
      prevBtn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        if (this._selectItem) this._selectItem(prevEntry);
      };
    }
    // 상태 배너: 상단 헤더 타이틀과 중복되던 불필요한 배너(AI 교정본 열람중, 정본 주석, 스펄전 설교전집 등) 말끔히 제거


    const polishRenderedCommentary = (targetContainer, navEntry) => {
      if (!targetContainer) return;
      const navFile = navEntry && idx?.files?.[navEntry[4]];
      const navIsMack = !!(navFile && navFile[0] === 'mackintosh');
      if (navIsMack) {
        formatMackintoshDOM(targetContainer);
      } else if (targetContainer.querySelector('.scf-chapter-hero-title, .scf-verse-head, .scf-passage-box, .scf-badge-head, .scf-crossref-row, .scf-qt-item, .scf-maxim-row, h2')) {
        targetContainer.addClass('scf-grand-article');
      }
      targetContainer.querySelectorAll('h3').forEach((h3) => {
        const t = (h3.textContent || '').trim();
        if (/■/.test(t) || /\s[—\-–]\s/.test(t)) {
          h3.classList.add('scf-topic-hero');
        }
      });
      targetContainer.querySelectorAll('.scf-ref-link').forEach((link) => {
        link.onclick = (evt) => {
          evt.stopPropagation();
          evt.preventDefault();
          const targetRef = link.getAttribute('data-ref');
          if (targetRef) {
            if (!this._navHistory) this._navHistory = [];
            this._navHistory.push({
              entry: navEntry || e,
              ref: this.current
            });
            this.search(targetRef);
          }
        };
      });
      linkifyVerseRefsInDOM(targetContainer, this.plugin, navEntry?.[0] || b, navEntry?.[1] ?? ch);
    };

    // 본문 텍스트 엘리먼트
    const contentEl = scrollContainer.createDiv({ cls: 'scf-fulltext' });
    const renderContent = (txt) => {
      contentEl.empty();
      contentEl.removeClass('scf-grand-article');
      contentEl.removeClass('scf-mack-article');
      try {
        MarkdownRenderer.render(this.plugin.app, txt || '', contentEl, '', this.plugin);
      } catch (err) {
        contentEl.createEl('pre', { text: txt || '' });
      }
      polishRenderedCommentary(contentEl, e);
      const scrollTargetV1 = e._isGrandVerseSub ? v1 : (r && r.v1 > 0 && ch === r.ch && v1 === 0 ? r.v1 : 0);
      if (scrollTargetV1 > 0) {
        const targets = contentEl.querySelectorAll('.scf-verse-head, .scf-qt-item, h4, .scf-passage-title');
        let matched = null;
        for (const node of targets) {
          const rawTxt = (node.textContent || '').trim().replace(/^📌\s*/, '');
          const m = rawTxt.match(/^[•●]?\s*(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-~]\s*(\d{1,3}))?/);
          if (!m) continue;
          const mc = parseInt(m[1], 10);
          const mv1 = parseInt(m[2], 10);
          const mv2 = m[3] ? parseInt(m[3], 10) : mv1;
          if (mc === ch && scrollTargetV1 >= mv1 && scrollTargetV1 <= mv2) {
            matched = node;
            if (!node.classList.contains('scf-passage-title')) break;
          }
        }
        if (matched) {
          matched.classList.add('scf-verse-target-flash');
          setTimeout(() => {
            try { matched.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {}
          }, 50);
        }
      }
    };
    renderContent(currentText);

    // 편집기 (기본 숨김)
    let continuousBox = null;
    const editWrap = scrollContainer.createDiv({ cls: 'scf-edit-wrap' });
    editWrap.style.display = 'none';
    const textarea = editWrap.createEl('textarea', { cls: 'scf-editor' });
    const editToolbar = editWrap.createDiv({ cls: 'scf-edit-toolbar' });
    const saveBtn = editToolbar.createEl('button', { cls: 'scf-mini-btn scf-save-btn', text: '💾 저장' });
    const cancelBtn = editToolbar.createEl('button', { cls: 'scf-mini-btn scf-cancel-btn', text: '취소' });
    editToolbar.createSpan({ cls: 'scf-edit-hint', text: '단축키: Ctrl+Enter 저장 / Esc 취소' });

    let isEditing = false;
    const enterEdit = () => {
      isEditing = true;
      textarea.value = currentText;
      contentEl.style.display = 'none';
      if (continuousBox) continuousBox.style.display = 'none';
      editWrap.style.display = 'flex';
      editBtn.setText('취소');
      setTimeout(() => {
        textarea.focus();
        textarea.style.height = Math.max(260, Math.min(textarea.scrollHeight + 15, 600)) + 'px';
      }, 30);
    };
    const exitEdit = () => {
      isEditing = false;
      editWrap.style.display = 'none';
      contentEl.style.display = 'block';
      if (continuousBox) continuousBox.style.display = 'block';
      editBtn.setText('✏️ 편집');
    };
    textarea.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); saveBtn.click(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); cancelBtn.click(); }
    });
    editBtn.onclick = (evt) => {
      evt.stopPropagation();
      if (isEditing) exitEdit(); else enterEdit();
    };
    cancelBtn.onclick = (evt) => { evt.stopPropagation(); exitEdit(); };
    saveBtn.onclick = async (evt) => {
      evt.stopPropagation();
      const val = textarea.value.trim();
      if (!val) { new Notice('본문 내용을 비워둘 수 없습니다.'); return; }
      saveBtn.disabled = true;
      saveBtn.setText('저장 중...');
      try {
        if (!bookData.corrected) bookData.corrected = {};
        if (!bookData._userCorrected) bookData._userCorrected = {};
        bookData.corrected[storageKey] = val;
        bookData._userCorrected[storageKey] = true;
        const bStr = String(b).padStart(2, '0');
        const legacyPath = `${this.plugin.manifest.dir}/data/b${bStr}.json`;
        if (!bookData._isChapterOnly && !bookData._fromPacks && await this.plugin.app.vault.adapter.exists(legacyPath)) {
          const saveObj = { ...bookData };
          delete saveObj._externalBookPath;
          await this.plugin.app.vault.adapter.write(legacyPath, JSON.stringify(saveObj));
        } else if (!bookData._isChapterOnly && !bookData._fromPacks && bookData._externalBookPath) {
          const fs = require('fs');
          const saveObj = { ...bookData };
          delete saveObj._externalBookPath;
          fs.writeFileSync(bookData._externalBookPath, JSON.stringify(saveObj), 'utf8');
        } else {
          await this.plugin.ensureVaultDir(`${this.plugin.manifest.dir}/data/chapters`);
          const chPath = `${this.plugin.manifest.dir}/data/chapters/b${bStr}-${ch}.json`;
          let existingCh = null;
          try {
            if (await this.plugin.app.vault.adapter.exists(chPath)) {
              existingCh = JSON.parse(await this.plugin.app.vault.adapter.read(chPath));
            }
          } catch (_) {}
          const baseObj = (existingCh && typeof existingCh === 'object') ? existingCh : { ...bookData };
          if (!baseObj.corrected) baseObj.corrected = {};
          if (!baseObj._userCorrected) baseObj._userCorrected = {};
          baseObj.corrected[storageKey] = val;
          baseObj._userCorrected[storageKey] = true;
          delete baseObj._isChapterOnly;
          delete baseObj._externalBookPath;
          delete baseObj._fromPacks;
          await this.plugin.app.vault.adapter.write(chPath, JSON.stringify(baseObj));
        }
        currentText = val;
        isCorrected = true;
        renderContent(currentText);
        badgeEl.className = 'scf-badge scf-badge-corrected';
        badgeEl.setText('✓ 교정/수정 저장본');
        exitEdit();
        new Notice('✓ 주석 텍스트 수정 사항이 영구 저장되었습니다.');
      } catch (err) {
        new Notice('저장 실패: ' + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.setText('💾 저장');
      }
    };

    // 5. 연속 주석 이어보기 (Continuous Section Scroll) 영역
    continuousBox = scrollContainer.createDiv({ cls: 'scf-continuous-box' });
    const pagesBox = continuousBox.createDiv({ cls: 'scf-continuous-pages' });

    // 책의 다음 주석 항목(Entry) 목록 순서에 따라 자연스럽게 이어보기
    let nextEntryIndex = -1;
    if (allSourceEntries && allSourceEntries.length > 0) {
      const nextCurIdx = allSourceEntries.indexOf(navSelf);
      if (nextCurIdx >= 0 && nextCurIdx + 1 < allSourceEntries.length) {
        nextEntryIndex = nextCurIdx + 1;
      }
    }



    let isLoadingNext = false;
    const loadNextSection = async () => {
      if (isLoadingNext) return;
      if (nextEntryIndex < 0 || !allSourceEntries || nextEntryIndex >= allSourceEntries.length) {
        nextPageBtn.style.display = 'none';
        endNotice.style.display = 'block';
        return;
      }
      isLoadingNext = true;
      const targetEntry = allSourceEntries[nextEntryIndex];
      const [tb, tch, tv1, tv2, tfi, tp1, tp2, tki, tsnip] = targetEntry;
      const targetCardKey = getEntryDomKey(targetEntry);
      const targetLabel = getEntryTitle(targetEntry);

      nextPageBtn.setText('⏳ 다음 주석 로딩 중...');

      let nextBookData = bookData;
      if (!nextBookData || (nextBookData._isChapterOnly && nextBookData.ch !== tch)) {
        try {
          nextBookData = await this.plugin.loadChapterData(tb, tch);
        } catch (err) {
          console.warn('loadChapterData next failed', err);
        }
      }

      // 다음 항목 본문 추출
      const targetFile = idx.files[tfi];
      const targetIsCleanMack = !!(targetFile && targetFile[0] === 'mackintosh' && tp1 >= 1000);
      let targetRaw = '';
      if (nextBookData && nextBookData.pages) {
        const chunks = [];
        for (let p = tp1; p <= tp2; p++) {
          const k = `${tfi}_${p}`;
          if (nextBookData.pages[k]) chunks.push(nextBookData.pages[k]);
        }
        const joinedNext = chunks.join('\n');
        targetRaw = targetIsCleanMack ? joinedNext.trim() : unwrapCommentary(joinedNext);
      }
      if (!targetRaw) targetRaw = cleanSnippet(tsnip) || '';

      const tCorr = getEntryCorrected(targetEntry, nextBookData);
      const tCorrupted = tCorr && (tCorr.trim().length < 20 && targetRaw.length > 200);
      const textToShow = (tCorr && !tCorrupted) ? (targetIsCleanMack ? tCorr.trim() : unwrapCommentary(tCorr)) : targetRaw;

      // 이어보기 구분 헤더 + 본문 렌더링
      const pageWrap = pagesBox.createDiv({ cls: 'scf-appended-page' });
      const divider = pageWrap.createDiv({ cls: 'scf-page-divider' });
      divider.setText(`📖 다음 주석 이어보기: ${targetLabel}`);

      const textEl = pageWrap.createDiv({ cls: 'scf-fulltext' });
      const formattedMarkdown = textToShow;
      try {
        MarkdownRenderer.render(this.plugin.app, formattedMarkdown, textEl, '', this.plugin);
      } catch (err) {
        textEl.createEl('pre', { text: textToShow });
      }
      polishRenderedCommentary(textEl, targetEntry);

      // 좌측 목록(listPanel) 활성 항목 동기화
      if (listPanel) {
        const nextRow = listPanel.querySelector(`.scf-list-item[data-card-key="${targetCardKey}"]`);
        if (nextRow) {
          listPanel.querySelectorAll('.scf-list-item').forEach(el => el.classList.remove('is-active'));
          nextRow.classList.add('is-active');
          scrollPanelToItem(listPanel, nextRow, 'nearest');
        }
      }

      // 다음 인덱스로 전진
      nextEntryIndex++;
      if (nextEntryIndex < allSourceEntries.length) {
        const nextLabel = getEntryTitle(allSourceEntries[nextEntryIndex]);
        nextPageBtn.setText(`📖 다음 주석: ${nextLabel} 이어보기 (휠 스크롤 또는 클릭)`);
      } else {
        nextPageBtn.style.display = 'none';
        endNotice.style.display = 'block';
      }
      isLoadingNext = false;
    };

    const nextPageBtn = continuousBox.createEl('button', {
      cls: 'scf-next-page-btn',
      text: (nextEntryIndex >= 0 && nextEntryIndex < (allSourceEntries ? allSourceEntries.length : 0))
        ? `📖 다음 주석: ${getEntryTitle(allSourceEntries[nextEntryIndex])} 이어보기 (휠 스크롤 또는 클릭)`
        : '',
      type: 'button'
    });

    const endNotice = continuousBox.createDiv({
      cls: 'scf-end-notice',
      text: '📖 해당 주석 책의 마지막 항목입니다.'
    });

    if (nextEntryIndex < 0 || !allSourceEntries || nextEntryIndex >= allSourceEntries.length) {
      nextPageBtn.style.display = 'none';
      endNotice.style.display = 'block';
    } else {
      endNotice.style.display = 'none';
    }

    const triggerNext = (ev) => {
      if (ev) ev.stopPropagation();
      loadNextSection();
    };
    nextPageBtn.onclick = triggerNext;
    nextPageBtn.addEventListener('pointerdown', triggerNext);

    // 휠 스크롤 및 일반 스크롤 모두 감지하여 맨 아래 도달 시 자동 로드
    let scrollDebounce = null;
    const handleScrollCheck = () => {
      if (isLoadingNext || nextPageBtn.style.display === 'none') return;
      if (scrollDebounce) return;
      scrollDebounce = setTimeout(() => {
        scrollDebounce = null;
        const scrollBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
        if (scrollBottom < 250) {
          loadNextSection();
        }
      }, 100);
    };

    scrollContainer.addEventListener('scroll', handleScrollCheck);
    scrollContainer.addEventListener('wheel', (ev) => {
      if (ev.deltaY > 0) {
        handleScrollCheck();
      }
    }, { passive: true });
  }

  onClose() {
    this.plugin.closeVersePopover();
  }
}


/* ------------------------------------------------------------------
 * 성경사전 뷰 (Bible Dictionary View)
 * 비전성경사전 및 아가페 성경사전의 3,120개 표제어를
 * 우측 사이드바 2단 패널(목록/상세)로 제공하며 원클릭 본문 링크 및 노트 삽입을 지원한다.
 * ------------------------------------------------------------------ */
class BibleDictionaryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedEntry = null;
    this.currentChosung = '전체';
    this.searchQuery = '';
    this.dictData = null;
    this.fontSize = this.plugin.settings.dictFontSize || 15;
    this._activePopover = null;
  }

  getViewType() { return VIEW_TYPE_DICT; }
  getDisplayText() { return '성경사전'; }
  getIcon() { return 'book-marked'; }

  recordLastFocused() {
    try {
      const bf = this.plugin.app.plugins?.plugins?.['obsidian-bible-finder'];
      if (bf) bf._lastFocusedBibleViewType = VIEW_TYPE_DICT;
    } catch (e) {}
  }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('scf-dict-view');
    root.addEventListener('click', () => this.recordLastFocused());
    root.addEventListener('focusin', () => this.recordLastFocused());

    this.dictData = await this.plugin.loadBibleDictionary();

    // 1. 검색창 헤더
    const head = root.createDiv({ cls: 'scf-dict-head' });
    const searchRow = head.createDiv({ cls: 'scf-dict-search-row' });
    this.searchEl = searchRow.createEl('input', {
      type: 'text',
      cls: 'scf-dict-search-input',
      placeholder: '성경 사전 표제어 검색 (예: 갈대아, 가나, 바벨론, 멜기세덱...)'
    });
    this.searchEl.setAttribute('enterkeyhint', 'search');
    
    const clearBtn = searchRow.createEl('button', { cls: 'scf-dict-clear-btn', text: '✕' });
    clearBtn.title = '검색어 지우기';
    clearBtn.onclick = () => {
      this.searchEl.value = '';
      this.searchQuery = '';
      this.renderList();
      this.searchEl.focus();
    };

    this.searchEl.addEventListener('input', () => {
      this.searchQuery = this.searchEl.value.trim().toLowerCase();
      this.renderList();
    });

    // 2. 옵션 바: 주석/스트롱코드와 100% 동일한 에디터 연동 체크박스 디자인 & 표제어 개수
    const opt = head.createDiv({ cls: 'scf-opt' });
    const optLeft = opt.createDiv({ cls: 'scf-opt-left' });
    optLeft.style.cssText = 'display: inline-flex; gap: 10px; align-items: center; flex-wrap: nowrap;';

    const editorLab = optLeft.createEl('label', { cls: 'scf-follow' });
    this.editorChk = editorLab.createEl('input', { type: 'checkbox' });
    this.editorChk.checked = !!this.plugin.settings.dictAutoFollowEditor;
    editorLab.appendText(' 에디터 연동');
    editorLab.title = '설교 노트(에디터)에서 단어를 선택하거나 커서를 둘 때 사전을 자동으로 검색합니다.';
    this.editorChk.onchange = async () => {
      this.plugin.settings.dictAutoFollowEditor = this.editorChk.checked;
      await this.plugin.saveSettings();
      new Notice(this.editorChk.checked ? '에디터 연동 켜짐' : '에디터 연동 꺼짐');
      if (this.editorChk.checked) this.plugin.handleEditorCursorActivity();
    };

    this.countEl = opt.createSpan({ cls: 'scf-status' });

    // 3. 초성 바로가기 버튼 바
    const chosungRow = head.createDiv({ cls: 'scf-dict-chosung-row' });
    const chosungs = ['전체', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'A-Z'];
    this.chosungBtns = {};
    for (const c of chosungs) {
      const btn = chosungRow.createEl('button', {
        cls: `scf-dict-chosung-btn ${c === this.currentChosung ? 'active' : ''}`,
        text: c
      });
      btn.onclick = () => {
        this.currentChosung = c;
        Object.values(this.chosungBtns).forEach(b => b.removeClass('active'));
        btn.addClass('active');
        this.renderList();
      };
      this.chosungBtns[c] = btn;
    }

    // 4. 2단 분할 레이아웃 (좌측: 표제어 목록, 리사이저 바, 우측: 상세 정의)
    this.splitEl = root.createDiv({ cls: 'scf-dict-split-container' });
    this.listEl = this.splitEl.createDiv({ cls: 'scf-dict-list-panel' });
    const dictResizer = this.splitEl.createDiv({ cls: 'scf-splitter' });
    dictResizer.createDiv({ cls: 'scf-splitter-grip' });
    this.detailEl = this.splitEl.createDiv({ cls: 'scf-dict-detail-panel' });

    setupSplitter(this.splitEl, this.listEl, this.detailEl, dictResizer, (newPct) => {
      this.plugin.settings.dictSplitPct = newPct;
      this.plugin.saveSettings();
    }, this.plugin.settings.dictSplitPct || 30);

    this.renderList();
    if (this.dictData && this.dictData.entries && this.dictData.entries.length > 0) {
      this.selectEntry(this.dictData.entries[0]);
    }
  }

  getFilteredEntries() {
    if (!this.dictData || !this.dictData.entries) return [];
    let list = this.dictData.entries;

    // 초성 필터
    if (this.currentChosung !== '전체') {
      list = list.filter(e => e.chosung === this.currentChosung);
    }

    // 검색어 필터
    if (this.searchQuery) {
      const q = this.searchQuery;
      list = list.filter(e => {
        return (e.title && e.title.toLowerCase().includes(q)) ||
               (e.eng && e.eng.toLowerCase().includes(q)) ||
               (e.hanja && e.hanja.includes(q)) ||
               (e.content && e.content.toLowerCase().includes(q));
      });
    }

    return list;
  }

  renderList() {
    this.listEl.empty();
    const filtered = this.getFilteredEntries();
    this.countEl.setText(`표제어 ${filtered.length.toLocaleString()}개`);

    if (filtered.length === 0) {
      this.listEl.createDiv({ cls: 'scf-dict-empty', text: '검색 결과가 없습니다.' });
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of filtered) {
      const card = document.createElement('div');
      card.className = 'scf-dict-item';
      if (this.selectedEntry && this.selectedEntry.id === item.id) {
        card.classList.add('active');
      }

      const titleRow = document.createElement('div');
      titleRow.className = 'scf-dict-item-title-row';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'scf-dict-item-title';
      titleSpan.textContent = item.title;
      titleRow.appendChild(titleSpan);

      if (item.eng || item.hanja) {
        const subSpan = document.createElement('span');
        subSpan.className = 'scf-dict-item-sub';
        const parts = [];
        if (item.eng) parts.push(item.eng);
        if (item.hanja) parts.push(item.hanja);
        subSpan.textContent = parts.join(' ');
        titleRow.appendChild(subSpan);
      }

      card.appendChild(titleRow);

      card.onclick = () => {
        this.listEl.querySelectorAll('.scf-dict-item').forEach(el => el.classList.remove('active'));
        card.classList.add('active');
        this.selectEntry(item);
      };

      fragment.appendChild(card);
    }
    this.listEl.appendChild(fragment);
  }

  selectEntry(entry) {
    this.selectedEntry = entry;
    this.detailEl.empty();
    this.closeVersePopover();
    if (!entry) return;

    this.detailEl.style.fontSize = `${this.fontSize}px`;

    // 상세 헤더
    const detailHead = this.detailEl.createDiv({ cls: 'scf-dict-detail-head' });
    
    const titleArea = detailHead.createDiv({ cls: 'scf-dict-detail-title-area' });
    const h2 = titleArea.createEl('h2', { cls: 'scf-dict-detail-title', text: entry.title });
    if (entry.eng || entry.hanja) {
      const sub = titleArea.createSpan({ cls: 'scf-dict-detail-sub' });
      const parts = [];
      if (entry.eng) parts.push(entry.eng);
      if (entry.hanja) parts.push(entry.hanja);
      sub.setText(parts.join(' '));
    }

    // 액션 버튼 바
    const actRow = detailHead.createDiv({ cls: 'scf-dict-action-row' });
    
    // 폰트 크기 조절 (+-)
    const fontGroup = actRow.createDiv({ cls: 'scf-dict-font-group' });
    const fontDownBtn = fontGroup.createEl('button', { cls: 'scf-dict-font-btn', text: '−' });
    fontDownBtn.title = '글꼴 축소';
    fontDownBtn.onclick = () => this.adjustFontSize(-1);

    this.fontSizeLabel = fontGroup.createSpan({ cls: 'scf-dict-font-label', text: `${this.fontSize}px` });

    const fontUpBtn = fontGroup.createEl('button', { cls: 'scf-dict-font-btn', text: '＋' });
    fontUpBtn.title = '글꼴 확대';
    fontUpBtn.onclick = () => this.adjustFontSize(1);

    // 복사 버튼
    const copyBtn = actRow.createEl('button', { cls: 'scf-dict-btn', text: '📋 복사' });
    copyBtn.title = '사전 정의 클립보드 복사';
    copyBtn.onclick = () => {
      const parts = [];
      parts.push(`【${entry.title}】`);
      if (entry.eng || entry.hanja) {
        const sub = [entry.eng, entry.hanja].filter(Boolean).join(' ');
        parts.push(`(${sub})`);
      }
      parts.push(`\n${entry.content}`);
      navigator.clipboard.writeText(parts.join(' '));
      new Notice(`📋 '${entry.title}' 정의가 복사되었습니다.`);
    };

    // 노트 삽입 버튼
    const insertBtn = actRow.createEl('button', { cls: 'scf-dict-btn', text: '📝 노트 삽입' });
    insertBtn.title = '현재 작성 중인 설교 노트에 사전 정의 삽입';
    insertBtn.onclick = () => {
      const mdView = this.plugin.lastActiveMarkdownView || this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!mdView || !mdView.editor) {
        new Notice('노트 삽입 실패: 마크다운 에디터 창을 먼저 한 번 클릭해 주세요.');
        return;
      }
      const sub = [entry.eng, entry.hanja].filter(Boolean).join(' ');
      const subText = sub ? `(${sub})` : '';
      const insertText = `> [!note] 성경사전: **${entry.title}** ${subText}\n> ${entry.content.replace(/\n/g, '\n> ')}\n\n`;
      mdView.editor.replaceSelection(insertText);
      new Notice(`📝 '${entry.title}' 사전 항목이 노트에 삽입되었습니다.`);
    };

    // 본문 내용 렌더링
    const bodyEl = this.detailEl.createDiv({ cls: 'scf-dict-detail-body' });
    const content = entry.content || '';
    const pContainer = bodyEl.createEl('div', { cls: 'scf-dict-text' });

    // 문장 중간의 비정상 줄바꿈 정리 및 단락 분리
    const rawParagraphs = content.split(/\n\s*\n+/);
    for (const rawPara of rawParagraphs) {
      if (!rawPara.trim()) continue;

      const lines = rawPara.split(/\r?\n/);
      let curBlock = [];

      const flushBlock = (text) => {
        if (!text || !text.trim()) return;
        let para = text.trim();

        // 1. [비전성경사전], [아가페성경사전], 【비전성경사전】, 【아가페성경사전】 출처 강조 표시
        const sourceHeaderMatch = para.match(/^([\[【]\s*(?:비전|아가페)\s*성경사전\s*[\]】])\s*(.*)$/);
        if (sourceHeaderMatch) {
          const badgeDiv = pContainer.createDiv({ cls: 'scf-dict-source-badge' });
          badgeDiv.setText(sourceHeaderMatch[1]);
          para = sourceHeaderMatch[2].trim();
          if (!para) return;
        }

        // 2. 숫자 사이의 비정상 공백 수정 (예: 창 11:3 1 -> 창 11:31)
        para = para.replace(/(\d+)\s*[:：]\s*(\d+)\s+(\d+)/g, '$1:$2$3');
        // 쉼표 앞뒤 공백 정돈 (예: 대상 15:16 ,27 -> 대상 15:16, 27)
        para = para.replace(/(\d+)\s*,\s*(\d+)/g, '$1, $2');

        const pEl = pContainer.createEl('p');

        // 3. 성경 장절 정규식 (쉼표로 연결된 추가 절 및 범위 완벽 지원: 대상 15:16, 27, 대하 5:12, 13, 대상 6:33, 15:17 등)
        const refRegex = /([1-3]?\s*[가-힣]{1,8}(?:\s*[1-3]서)?\s*\d{1,3}\s*[:：장편.]\s*\d{1,3}(?:\s*[-~–]\s*\d{1,3})?(?:\s*,\s*(?:\d{1,3}\s*[:：]\s*)?\d{1,3}(?:\s*[-~–]\s*\d{1,3})?)*)/g;
        let lastIdx = 0;
        let match;
        while ((match = refRegex.exec(para)) !== null) {
          const refStr = match[1];
          const parsed = parseMultiRef(refStr) || parseRef(refStr);
          if (!parsed) continue;

          if (match.index > lastIdx) {
            pEl.appendText(para.substring(lastIdx, match.index));
          }
          const link = pEl.createEl('span', { cls: 'scf-dict-verse-link', text: refStr });
          const displayLabel = parsed.label || refStr;
          link.title = `클릭 시 구절 보기: ${displayLabel}`;
          link.onclick = async (e) => {
            e.stopPropagation();
            await this.showVersePopover(refStr, link);
          };
          lastIdx = match.index + match[0].length;
        }
        if (lastIdx < para.length) {
          pEl.appendText(para.substring(lastIdx));
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[\[【]\s*(?:비전|아가페)\s*성경사전\s*[\]】]/.test(trimmed)) {
          if (curBlock.length) {
            flushBlock(curBlock.join(' '));
            curBlock = [];
          }
          flushBlock(trimmed);
        } else {
          curBlock.push(trimmed);
        }
      }
      if (curBlock.length) {
        flushBlock(curBlock.join(' '));
      }
    }
  }

  adjustFontSize(delta) {
    this.fontSize = Math.max(11, Math.min(28, (this.fontSize || 15) + delta));
    if (this.detailEl) {
      this.detailEl.style.fontSize = `${this.fontSize}px`;
    }
    if (this.fontSizeLabel) {
      this.fontSizeLabel.setText(`${this.fontSize}px`);
    }
    this.plugin.settings.dictFontSize = this.fontSize;
    this.plugin.saveSettings();
  }

  async showVersePopover(refStr, targetEl) {
    return this.plugin.showVersePopover(refStr, targetEl);
  }

  closeVersePopover() {
    this.plugin.closeVersePopover();
  }

  searchAndSelect(term) {
    if (!term || typeof term !== 'string') return;
    const cleanTerm = term.trim().replace(/^[\[\(\{<"\'‘“]+|[\]\)\}>"\'’”.,·:;!?]+$/g, '');
    if (!cleanTerm || cleanTerm.length < 2) return;

    if (this.searchEl) this.searchEl.value = cleanTerm;
    this.searchQuery = cleanTerm.toLowerCase();
    this.currentChosung = '전체';
    if (this.chosungBtns) {
      Object.values(this.chosungBtns).forEach(b => b.removeClass('active'));
      if (this.chosungBtns['전체']) this.chosungBtns['전체'].addClass('active');
    }

    this.renderList();

    const filtered = this.getFilteredEntries();
    if (filtered.length > 0) {
      const cleanNorm = cleanTerm.replace(/\s+/g, '');
      const exact = filtered.find(e => e.title === cleanTerm || e.title.replace(/\s+/g, '') === cleanNorm);
      const target = exact || filtered[0];
      this.selectEntry(target);
      const activeCard = this.listEl.querySelector('.scf-dict-item.active');
      if (activeCard) {
        activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  onClose() {
    this.closeVersePopover();
  }
}

class CommentarySettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const idx = this.plugin.index;
    containerEl.createEl('p', {
      text: idx
        ? `색인: 항목 ${idx.entries.length.toLocaleString()}개 · PDF ${idx.files.length}개 · 생성 ${idx.created}`
        : '색인 파일을 찾지 못했습니다.',
    }).style.cssText = 'color: var(--text-muted); font-size: 12px;';

    new Setting(containerEl)
      .setName('PDF를 열 프로그램')
      .setDesc('기본 프로그램(추천)은 Windows 기본 뷰어(Acrobat 등)로 가장 빠르고 확실하게 엽니다. Edge/Chrome은 브라우저로 해당 쪽을 엽니다.')
      .addDropdown((d) => d
        .addOption('system', '기본 프로그램 (Acrobat 등 시스템 기본 뷰어 - 추천)')
        .addOption('edge', 'Microsoft Edge (해당 쪽으로 이동)')
        .addOption('chrome', 'Google Chrome (해당 쪽으로 이동)')
        .setValue(s.viewer || 'system')
        .onChange(async (v) => { s.viewer = v; await this.plugin.saveSettings(); }));

    const pathRow = (name, key) => new Setting(containerEl)
      .setName(name)
      .addText((t) => {
        t.inputEl.style.width = '360px';
        t.setValue(s[key]).onChange(async (v) => { s[key] = v.trim(); await this.plugin.saveSettings(); });
      });
    pathRow('Acrobat 경로', 'acrobatPath');
    pathRow('Edge 경로', 'edgePath');
    pathRow('Chrome 경로', 'chromePath');

    new Setting(containerEl)
      .setName('주석 본문 글자 크기')
      .setDesc('주석 본문의 기본 글자 크기(12~26px)를 설정합니다. 리더 화면 상단의 A- / A+ 버튼으로도 바로 조절할 수 있습니다.')
      .addSlider((slider) => slider
        .setLimits(12, 26, 1)
        .setValue(s.readerFontSize || 15)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.readerFontSize = v;
          await this.plugin.saveSettings();
          const view = this.plugin.getView();
          if (view && view.contentEl) {
            view.contentEl.style.setProperty('--scf-font-size', `${v}px`);
          }
        }));

    new Setting(containerEl)
      .setName('성경 책 이름 표기 (역본·스트롱 일치)')
      .setDesc('주석 타이틀과 카드에 표시되는 성경책 이름 형태를 선택합니다.')
      .addDropdown((d) => d
        .addOption('auto', '성경 찾기와 동일하게 자동 일치 (추천)')
        .addOption('short', '약어 (창, 마, 요)')
        .addOption('full', '전체 이름 (창세기, 마태복음, 요한복음)')
        .setValue(s.bookNameFormat || 'auto')
        .onChange(async (v) => {
          s.bookNameFormat = v;
          await this.plugin.saveSettings();
          const view = this.plugin.getView();
          if (view && view.current) view.render(view.current);
        }));

    new Setting(containerEl)
      .setName('성경사전 본문 글자 크기')
      .setDesc('성경사전 본문의 기본 글자 크기(11~28px)를 설정합니다. 사전 상단의 − / ＋ 버튼으로도 조절할 수 있습니다.')
      .addSlider((slider) => slider
        .setLimits(11, 28, 1)
        .setValue(s.dictFontSize || 15)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.dictFontSize = v;
          await this.plugin.saveSettings();
          const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICT)[0];
          if (leaf && leaf.view instanceof BibleDictionaryView) {
            leaf.view.fontSize = v;
            if (leaf.view.detailEl) leaf.view.detailEl.style.fontSize = `${v}px`;
            if (leaf.view.fontSizeLabel) leaf.view.fontSizeLabel.setText(`${v}px`);
          }
        }));

    new Setting(containerEl)
      .setName('성경사전 에디터 자동 연동')
      .setDesc('설교 노트에서 단어를 선택하거나 커서를 둘 때, 우측 성경사전에서 해당 단어를 자동으로 조회합니다.')
      .addToggle((t) => t.setValue(!!s.dictAutoFollowEditor).onChange(async (v) => { s.dictAutoFollowEditor = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('성경 찾기 검색 따라가기')
      .setDesc('성경 찾기의 "역본 비교" / "스트롱 원어" 화면에서 장절을 검색하면 주석 찾기 창도 자동으로 그 장절을 보여 줍니다. (성경 찾기 플러그인은 수정하지 않고 검색어만 읽습니다.)')
      .addToggle((t) => t.setValue(!!s.autoFollow).onChange(async (v) => { s.autoFollow = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('에디터 커서 위치 자동 따라가기')
      .setDesc('설교 노트(마크다운 에디터)에서 커서를 움직일 때, 커서가 위치한 줄의 성경 장절 주석을 자동으로 우측 창에 표시합니다.')
      .addToggle((t) => t.setValue(!!s.autoFollowEditor).onChange(async (v) => { s.autoFollowEditor = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('주석 텍스트 전문 자동 펼치기')
      .setDesc('검색 시 주석 본문 텍스트를 카드 형태로 즉시 펼쳐서 보여줍니다. (끄면 쪽수 목록만 보이고 버튼을 눌러 펼칩니다)')
      .addToggle((t) => t.setValue(!!s.autoExpandText).onChange(async (v) => { s.autoExpandText = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Gemini API 키 (개역한글 대조 AI 교정용)')
      .setDesc('주석 본문의 OCR 오탈자를 개역한글 성경 원문과 대조하여 교정할 때 사용합니다. 비워 두면 [설교 마인드맵]에 등록된 API 키를 자동으로 공유하여 사용합니다.')
      .addText((t) => {
        t.inputEl.style.width = '360px';
        t.inputEl.type = 'password';
        t.setPlaceholder('AI Studio 키 입력 (마인드맵 키가 있으면 비워도 됨)')
          .setValue(s.geminiApiKey || '')
          .onChange(async (v) => {
            s.geminiApiKey = v.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('장 전체 관련 자료 보이기')
      .setDesc('절 해설 외에, 그 장에 딸린 설교·연구자료·금언·장 개관 쪽도 접어서 보여 줍니다.')
      .addToggle((t) => t.setValue(!!s.showChapterLevel).onChange(async (v) => { s.showChapterLevel = v; await this.plugin.saveSettings(); }));

    containerEl.createEl('h3', { text: 'BRAT · 아이패드 경량 데이터 동기화' });

    new Setting(containerEl)
      .setName('데이터 저장소 (GitHub)')
      .setDesc('장 단위 주석 JSON 및 색인을 내려받을 GitHub 저장소 (예: owner/repo)')
      .addText((t) => t
        .setPlaceholder('hyod9866/sermon-commentary-data')
        .setValue(s.dataRepo || '')
        .onChange(async (v) => {
          s.dataRepo = v.trim() || DEFAULT_SETTINGS.dataRepo;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('PC 외부 주석 데이터 폴더 (옵시디언 Sync 제외)')
      .setDesc('b01~b66.json 및 bible-dict.json을 보관함 밖 폴더에 두고 PC에서 바로 읽습니다. 폴더가 없으면 GitHub에서 필요한 장만 자동 다운로드합니다.')
      .addText((t) => {
        t.inputEl.style.width = '360px';
        t.setPlaceholder(DEFAULT_SETTINGS.externalDataDir)
          .setValue(s.externalDataDir || '')
          .onChange(async (v) => {
            s.externalDataDir = v.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('최신 색인·복원본 동기화')
      .setDesc('GitHub에서 최신 색인과 복원 상태 목록을 받아오고, 갱신된 장 로컬 캐시를 정리합니다.')
      .addButton((b) => b
        .setButtonText('🔄 최신 색인·복원본 동기화')
        .onClick(async () => {
          await this.plugin.syncRemoteData(true);
        }));

    new Setting(containerEl)
      .setName('다운로드된 장 캐시 비우기')
      .setDesc('기기에 저장된 장 단위 캐시 파일(data/chapters)을 삭제해 용량을 확보합니다.')
      .addButton((b) => b
        .setButtonText('🧹 다운로드된 장 캐시 비우기')
        .onClick(async () => {
          await this.plugin.clearChapterCache();
        }));

    new Setting(containerEl)
      .setName('구버전 로컬 주석 파일 정리 (충돌 방지)')
      .setDesc('플러그인 data 폴더 안에 옛날 b01~b66.json이 남아 있으면 GitHub 최신본과 충돌하므로 삭제하고 온디맨드 동기화로 전환합니다.')
      .addButton((b) => b
        .setButtonText('🗑️ 구버전 b01~b66.json 삭제')
        .onClick(async () => {
          const files = await this.plugin.listLegacyVaultDataFiles();
          if (!files.length) {
            new Notice('✓ 정리할 구버전 로컬 파일(b01~b66.json)이 없습니다.');
            return;
          }
          await this.plugin.cleanLegacyVaultDataFiles();
        }));

    containerEl.createEl('h3', { text: '📥 주석별 선택 다운로드 (PC · 아이패드 오프라인)' });
    const isMobileEnv = !!(Platform && Platform.isMobile);
    const packLocDesc = isMobileEnv
      ? `저장 위치: ${this.plugin.manifest.dir}/data/packs/ (이 기기 전용 오프라인 보관 · ⚠ 아이패드에서 그랜드 주석(약 516MB 압축해제) 등 대용량 팩을 받을 경우 Obsidian Sync 설정 → '설치된 커뮤니티 플러그인' 동기화를 끄면 1GB 제한에 걸리지 않습니다.)`
      : `저장 위치: ${this.plugin._getPackStorageRoot()}\\packs\\ (옵시디언 보관함 외부 폴더이므로 Sync 용량 0 MB)`;
    const packIntro = containerEl.createDiv({ cls: 'scf-packs-intro' });
    packIntro.createEl('div', { text: '원하는 주석 팩만 골라 GitHub Releases에서 통째로 내려받아 오프라인으로도 바로 열람할 수 있습니다.' });
    packIntro.createEl('div', { cls: 'scf-packs-path', text: packLocDesc });

    new Setting(containerEl)
      .setName('설치한 주석 팩만 로컬 사용 (온라인 자동 조회 끄기)')
      .setDesc('켜면 내가 내려받은 주석 팩의 내용만 표시하고, 설치하지 않은 주석은 GitHub에서 자동으로 내려받지 않습니다.')
      .addToggle((t) => t
        .setValue(Boolean(s.installedPacksOnly))
        .onChange(async (v) => {
          s.installedPacksOnly = v;
          this.plugin._chapterCache.clear();
          await this.plugin.saveSettings();
        }));

    const packToolbar = containerEl.createDiv({ cls: 'scf-packs-toolbar' });
    const refreshBtn = packToolbar.createEl('button', { text: '🔄 팩 목록·업데이트 확인' });
    const statusLabel = packToolbar.createSpan({ cls: 'scf-packs-status-msg', text: '' });
    const packsListEl = containerEl.createDiv({ cls: 'scf-packs-list' });

    const renderPackRows = () => {
      packsListEl.empty();
      const manifest = this.plugin._packsManifestData;
      const installed = (this.plugin.settings && this.plugin.settings.installedPacks) || {};
      for (const def of PACK_DEFS) {
        const remoteInfo = manifest && manifest.packs ? manifest.packs[def.id] : null;
        const localInfo = installed[def.id] || null;
        const hasUpdate = Boolean(localInfo && remoteInfo && remoteInfo.hash && localInfo.hash !== remoteInfo.hash);

        const row = packsListEl.createDiv({ cls: 'scf-pack-row' });
        const infoCol = row.createDiv({ cls: 'scf-pack-info' });
        const titleRow = infoCol.createDiv({ cls: 'scf-pack-title-row' });
        titleRow.createSpan({ cls: 'scf-pack-name', text: def.name });

        let badgeCls = 'scf-pack-badge scf-pack-badge-none';
        let badgeTxt = '미설치';
        if (hasUpdate) {
          badgeCls = 'scf-pack-badge scf-pack-badge-update';
          badgeTxt = '업데이트 있음';
        } else if (localInfo) {
          badgeCls = 'scf-pack-badge scf-pack-badge-ok';
          badgeTxt = '✓ 설치됨';
        }
        titleRow.createSpan({ cls: badgeCls, text: badgeTxt });

        const metaParts = [def.desc];
        if (remoteInfo) {
          metaParts.push(`다운로드 ${formatBytesMb(remoteInfo.zipBytes)} (해제 후 ${formatBytesMb(remoteInfo.rawBytes)} · ${remoteInfo.fileCount}파일)`);
        } else if (localInfo) {
          metaParts.push(`${localInfo.fileCount || 0}파일 · 해제 ${formatBytesMb(localInfo.rawBytes || localInfo.zipBytes)}`);
        }
        infoCol.createDiv({ cls: 'scf-pack-desc', text: metaParts.join(' · ') });

        const btnCol = row.createDiv({ cls: 'scf-pack-actions' });
        const dlBtn = btnCol.createEl('button', {
          cls: localInfo ? 'scf-mini-btn' : 'mod-cta scf-mini-btn',
          text: hasUpdate ? '🔄 업데이트' : (localInfo ? '↻ 재설치' : '⬇ 다운로드'),
        });
        dlBtn.onclick = async () => {
          dlBtn.disabled = true;
          const origText = dlBtn.textContent;
          try {
            statusLabel.setText(`${def.name} 내려받는 중...`);
            const res = await this.plugin.installPack(def.id, (msg) => {
              dlBtn.setText(msg);
              statusLabel.setText(`${def.name}: ${msg}`);
            });
            statusLabel.setText(`✓ ${def.name} 설치 완료 (${res.writtenCount}개 파일)`);
            new Notice(`✅ ${def.name} 설치 완료! (${res.writtenCount}개 파일)`);
            renderPackRows();
          } catch (err) {
            statusLabel.setText(`❌ ${def.name} 실패: ${err.message}`);
            new Notice(`❌ ${def.name} 다운로드 실패: ${err.message}`, 8000);
            dlBtn.disabled = false;
            dlBtn.setText(origText);
          }
        };

        if (localInfo) {
          const delBtn = btnCol.createEl('button', { cls: 'scf-mini-btn scf-pack-del-btn', text: '삭제' });
          delBtn.onclick = async () => {
            delBtn.disabled = true;
            try {
              await this.plugin.uninstallPack(def.id);
              statusLabel.setText(`🗑️ ${def.name} 삭제됨`);
              new Notice(`🗑️ ${def.name} 로컬 팩 삭제 완료`);
              renderPackRows();
            } catch (err) {
              new Notice(`삭제 실패: ${err.message}`);
              delBtn.disabled = false;
            }
          };
        }
      }
    };

    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      statusLabel.setText('GitHub에서 최신 팩 목록을 확인하는 중...');
      try {
        await this.plugin.fetchPacksManifest(true);
        statusLabel.setText('✓ 최신 팩 목록 확인 완료');
        renderPackRows();
      } catch (err) {
        statusLabel.setText(`❌ 목록 조회 실패: ${err.message}`);
      } finally {
        refreshBtn.disabled = false;
      }
    };

    renderPackRows();
    if (!this.plugin._packsManifestData) {
      this.plugin.fetchPacksManifest(false).then(() => renderPackRows()).catch(() => {});
    }

    if (idx) {
      containerEl.createEl('h3', { text: '주석 폴더 위치' });
      containerEl.createEl('p', { text: '주석 폴더를 다른 곳으로 옮겼다면 새 경로를 적어 주세요. 비워 두면 색인을 만들 때의 경로를 씁니다.' })
        .style.cssText = 'color: var(--text-muted); font-size: 12px;';
      for (const [sid, src] of Object.entries(idx.sources)) {
        new Setting(containerEl)
          .setName(src.name)
          .setDesc(src.root)
          .addText((t) => {
            t.inputEl.style.width = '360px';
            t.setPlaceholder(src.root).setValue(s.rootOverrides[sid] || '').onChange(async (v) => {
              if (v.trim()) s.rootOverrides[sid] = v.trim(); else delete s.rootOverrides[sid];
              await this.plugin.saveSettings();
            });
          });
      }
    }
  }
}

module.exports = class CommentaryFinderPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.index = null;
    this.lookup = new Map();
    this._bookCache = new Map();
    this._packBookCache = new Map();
    this._chapterCache = new Map();
    this._manifestData = null;
    this._packsManifestData = null;
    if (!this.settings.chapterHashes) this.settings.chapterHashes = {};
    if (!this.settings.installedPacks) this.settings.installedPacks = {};
    await this.loadLocalManifest();
    await this.loadLocalPacksManifest();
    await this.loadIndex();
    this.syncRemoteManifestSilent();
    this._legacyCheckTimer = setTimeout(() => {
      this._legacyCheckTimer = null;
      this.checkAndWarnLegacyData();
    }, 2500);

    this.registerView(VIEW_TYPE, (leaf) => new CommentaryView(leaf, this));
    this.addRibbonIcon('library', '주석 찾기', () => this.activateView());
    this.registerView(VIEW_TYPE_DICT, (leaf) => new BibleDictionaryView(leaf, this));
    this.addRibbonIcon('book-marked', '성경사전', () => this.activateDictionaryView());

    this.addCommand({
      id: 'search-bible-dictionary-cursor',
      name: '커서 위치(선택한) 단어로 성경사전 검색',
      editorCallback: async (editor) => {
        const sel = editor.getSelection();
        let text = sel && sel.trim() ? sel.trim() : this.getWordAtCursor(editor.getLine(editor.getCursor().line), editor.getCursor().ch);
        if (text) {
          await this.activateDictionaryView();
          const dictLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICT)[0];
          if (dictLeaf && dictLeaf.view instanceof BibleDictionaryView) {
            dictLeaf.view.searchAndSelect(text);
          }
        }
      },
    });

    this.addCommand({
      id: 'open-bible-dictionary-view',
      name: '성경사전 창 열기 (우측 패널)',
      callback: () => this.activateDictionaryView(),
    });

    this.addCommand({
      id: 'focus-bible-dictionary-search',
      name: '성경사전 검색창으로 바로 가기 (Focus Bible Dictionary Search)',
      callback: () => {
        const dictLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICT)[0];
        if (dictLeaf && dictLeaf.view instanceof BibleDictionaryView) {
          this.app.workspace.revealLeaf(dictLeaf);
          if (dictLeaf.view.searchEl) {
            dictLeaf.view.searchEl.focus();
            dictLeaf.view.searchEl.select();
          }
        } else {
          this.activateDictionaryView().then(() => {
            const l = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICT)[0];
            if (l && l.view && l.view.searchEl) {
              l.view.searchEl.focus();
              l.view.searchEl.select();
            }
          });
        }
      },
    });

    this.addCommand({
      id: 'open-commentary-view',
      name: '주석 찾기 창 열기',
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: 'find-commentary-at-cursor',
      name: '커서 위치(선택한) 장절의 주석 찾기',
      editorCallback: (editor) => {
        const sel = editor.getSelection();
        const text = sel && sel.trim() ? sel : editor.getLine(editor.getCursor().line);
        this.findFor(text);
      },
    });

    // 편집기 활성 뷰 추적 (주석에서 "노트 삽입" 시 대상 에디터 자동 지정)
    this.lastActiveMarkdownView = null;
    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
      if (leaf && leaf.view instanceof MarkdownView) {
        this.lastActiveMarkdownView = leaf.view;
      }
    }));

    // 편집기 우클릭 메뉴: 줄에 장절이 있으면 "주석 찾기" 항목 추가
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
      try {
        const sel = editor.getSelection();
        const text = sel && sel.trim() ? sel : editor.getLine(editor.getCursor().line);
        const r = parseRef(text);
        if (r) {
          menu.addItem((item) => item
            .setTitle(`📚 주석 찾기: ${refLabel(r, this)}`)
            .setIcon('library')
            .onClick(() => this.findFor(text)));
        }
        // 성경사전 메뉴 항목 추가
        const term = sel && sel.trim() ? sel.trim() : this.getWordAtCursor(editor.getLine(editor.getCursor().line), editor.getCursor().ch);
        if (term && term.length >= 2 && term.length <= 15 && !parseRef(term)) {
          menu.addItem((item) => item
            .setTitle(`📖 성경사전 검색: ${term}`)
            .setIcon('book-marked')
            .onClick(async () => {
              await this.activateDictionaryView();
              const dictLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICT)[0];
              if (dictLeaf && dictLeaf.view instanceof BibleDictionaryView) {
                dictLeaf.view.searchAndSelect(term);
              }
            }));
        }
      } catch (e) { /* 무시 */ }
    }));

    // 에디터 커서 위치 실시간 주석 추적 (클릭 / 터치 / 화살표 이동 지원 - 디바운스 적용)
    let editorSyncTimer = null;
    const triggerEditorSync = (evt) => {
      if (!this.settings.autoFollowEditor && !this.settings.dictAutoFollowEditor) return;
      if (evt && evt.target) {
        const tag = evt.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (typeof evt.target.closest === 'function' && evt.target.closest('.scf-view')) return;
      }
      let clickedLine = null;
      if (evt && evt.target && typeof evt.target.closest === 'function') {
        const cmLine = evt.target.closest('.cm-line');
        if (cmLine && cmLine.textContent) clickedLine = cmLine.textContent;
      }
      if (editorSyncTimer) clearTimeout(editorSyncTimer);
      editorSyncTimer = setTimeout(() => {
        editorSyncTimer = null;
        this.handleEditorCursorActivity(clickedLine);
      }, 120);
    };

    this.registerDomEvent(document, 'click', triggerEditorSync);
    this.registerDomEvent(document, 'keyup', triggerEditorSync);

    // 에디터 텍스트 변경 이벤트에서도 추적
    let editorDebounceTimer = null;
    this.registerEvent(this.app.workspace.on('editor-change', (editor) => {
      if (!this.settings.autoFollowEditor && !this.settings.dictAutoFollowEditor) return;
      if (editorDebounceTimer) clearTimeout(editorDebounceTimer);
      editorDebounceTimer = setTimeout(() => {
        try {
          const lineText = editor.getLine(editor.getCursor().line);
          this.handleEditorCursorActivity(lineText);
        } catch (e) {}
      }, 400);
    }));

    // 성경 찾기 화면 검색어 따라가기 (읽기 전용 폴링) 및 버튼 주입
    this._lastFollow = '';
    this.registerInterval(window.setInterval(() => {
      this.followBibleFinder();
      this.injectButtonsIntoBibleFinder();
    }, 600));

    // Alt+D 단축키로 주석/성경사전 검색창 포커스
    this.registerDomEvent(window, 'keydown', (e) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeType = activeLeaf && activeLeaf.view && typeof activeLeaf.view.getViewType === 'function' ? activeLeaf.view.getViewType() : '';
        if (activeType === VIEW_TYPE_DICT) {
          e.preventDefault();
          e.stopPropagation();
          const inp = activeLeaf.view.containerEl?.querySelector('.scf-dict-search-input');
          if (inp) {
            inp.focus();
            inp.select();
          }
        } else if (activeType === VIEW_TYPE) {
          e.preventDefault();
          e.stopPropagation();
          const inp = activeLeaf.view.containerEl?.querySelector('.scf-input');
          if (inp) {
            inp.focus();
            inp.select();
          }
        }
      }
    }, true);

    this.addSettingTab(new CommentarySettingTab(this.app, this));
  }

  getCommentaryCount(text) {
    const r = parseRef(text);
    if (!r || !this.lookup) return 0;
    const list = this.lookup.get(`${r.b}:${r.ch}`) || [];
    let cnt = 0;
    for (const e of list) {
      const [, , v1, v2] = e;
      if (v1 === 0 || !r.v1 || (v1 <= r.v2 && v2 >= r.v1)) cnt++;
    }
    return cnt;
  }

  injectButtonsIntoBibleFinder() {
    try {
      // 1. 역본 비교 화면 주입
      const compRows = document.querySelectorAll('.bible-compare-row2');
      compRows.forEach((row) => {
        let grp = row.querySelector('.scf-injected-group');
        if (!grp) {
          grp = row.createDiv({ cls: 'scf-injected-group' });
          grp.style.cssText = 'display: inline-flex; gap: 4px; align-items: center; margin-left: 2px;';

          const btn = grp.createEl('button', {
            cls: 'bible-compare-btn scf-injected-btn',
            text: '📚 주석',
            title: '이 장절의 주석 보기 (그랜드 종합주석, 옥스퍼드 원어대전)'
          });
          btn.style.cssText = 'padding: 4px 8px; height: 28px; font-size: 0.85em; cursor: pointer; white-space: nowrap; font-weight: 600; border-radius: 4px;';

          const splitBtn = grp.createEl('button', {
            cls: 'bible-compare-btn scf-injected-split',
            text: '⧉',
            title: '주석 창을 나란히(우측에 분할하여) 열기'
          });
          splitBtn.style.cssText = 'padding: 4px 6px; height: 28px; font-size: 0.85em; cursor: pointer; border-radius: 4px;';

          btn.onclick = () => {
            const input = row.closest('.bible-compare-container')?.querySelector('.bible-compare-search-input');
            const q = input?.value?.trim() || '';
            this.findFor(q);
          };

          splitBtn.onclick = async () => {
            const input = row.closest('.bible-compare-container')?.querySelector('.bible-compare-search-input');
            const q = input?.value?.trim() || '';
            await this.openSideBySide(q);
          };
        }

        // 원어(스트롱) 버튼 바로 우측으로 배치 유지
        const strongBtn = row.querySelector('.bible-compare-strong-btn') ||
          Array.from(row.children).find((el) => el.tagName === 'BUTTON' && (el.textContent || '').includes('원어'));
        if (strongBtn && strongBtn.nextElementSibling !== grp && typeof strongBtn.insertAdjacentElement === 'function') {
          strongBtn.insertAdjacentElement('afterend', grp);
        }

        // 건수 배지 실시간 업데이트
        const input = row.closest('.bible-compare-container')?.querySelector('.bible-compare-search-input');
        const q = input?.value?.trim() || '';
        const btn = row.querySelector('.scf-injected-btn');
        if (btn) {
          const cnt = this.getCommentaryCount(q);
          btn.textContent = cnt > 0 ? `📚 주석 (${cnt})` : '📚 주석';
          btn.style.opacity = cnt > 0 ? '1' : '0.65';
        }
      });

      // 2. 스트롱 원어 성경 화면 주입
      const strongControls = document.querySelectorAll('.strong-bible-controls-row > div:first-child');
      strongControls.forEach((leftBtns) => {
        if (!leftBtns.querySelector('.scf-injected-group')) {
          const grp = leftBtns.createDiv({ cls: 'scf-injected-group' });
          grp.style.cssText = 'display: inline-flex; gap: 4px; align-items: center; margin-left: 2px;';

          const btn = grp.createEl('button', {
            cls: 'scf-injected-btn',
            text: '📚 주석',
            title: '이 장절의 주석 보기 (그랜드 종합주석, 옥스퍼드 원어대전)'
          });
          btn.style.cssText = 'padding: 4px 8px; height: 28px; font-size: 0.85em; cursor: pointer; white-space: nowrap; font-weight: 600; border-radius: 4px; border: 1px solid var(--border-color); background-color: var(--background-modifier-border); color: var(--text-normal);';

          const splitBtn = grp.createEl('button', {
            cls: 'scf-injected-split',
            text: '⧉',
            title: '주석 창을 나란히(우측에 분할하여) 열기'
          });
          splitBtn.style.cssText = 'padding: 4px 6px; height: 28px; font-size: 0.85em; cursor: pointer; border-radius: 4px; border: 1px solid var(--border-color); background-color: var(--background-modifier-border); color: var(--text-normal);';

          btn.onclick = () => {
            const input = leftBtns.closest('.strong-bible-header')?.querySelector('.strong-bible-search-input');
            const q = input?.value?.trim() || '';
            this.findFor(q);
          };

          splitBtn.onclick = async () => {
            const input = leftBtns.closest('.strong-bible-header')?.querySelector('.strong-bible-search-input');
            const q = input?.value?.trim() || '';
            await this.openSideBySide(q);
          };
        }

        const input = leftBtns.closest('.strong-bible-header')?.querySelector('.strong-bible-search-input');
        const q = input?.value?.trim() || '';
        const btn = leftBtns.querySelector('.scf-injected-btn');
        if (btn) {
          const cnt = this.getCommentaryCount(q);
          btn.textContent = cnt > 0 ? `📚 주석 (${cnt})` : '📚 주석';
          btn.style.opacity = cnt > 0 ? '1' : '0.65';
        }
      });
    } catch (e) { /* 무시 */ }
  }

  async openSideBySide(text) {
    const { workspace } = this.app;
    // 현재 활성 탭 옆에 새 분할 창 생성
    let leaf = workspace.createLeafBySplit(workspace.activeLeaf, 'vertical');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
    if (leaf.view && leaf.view.search && text) {
      leaf.view.search(text);
    }
  }

  getTargetEditor() {
    if (this.lastActiveMarkdownView && this.lastActiveMarkdownView.editor) {
      return this.lastActiveMarkdownView.editor;
    }
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active && active.editor) return active.editor;
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      if (leaf.view && leaf.view.editor) return leaf.view.editor;
    }
    return null;
  }

  handleEditorCursorActivity(explicitLine = null) {
    if (!this.settings.autoFollowEditor && !this.settings.dictAutoFollowEditor) return;
    if (this._manualSearchLockUntil && Date.now() < this._manualSearchLockUntil) return;
    try {
      const activeEl = document.activeElement;
      if (activeEl && !explicitLine) {
        const tag = activeEl.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (typeof activeEl.closest === 'function') {
          if (activeEl.closest('.scf-view') || activeEl.closest('.scf-dict-view') || activeEl.closest('.strong-bible-view-container') || activeEl.closest('.bible-compare-container')) {
            return;
          }
        }
      }

      const editor = this.getTargetEditor();
      if (!editor) return;

      // 1. 성경사전 자동 연동 (dictAutoFollowEditor 활성 시)
      if (this.settings.dictAutoFollowEditor) {
        const dictLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICT)[0];
        if (dictLeaf && dictLeaf.view instanceof BibleDictionaryView) {
          let term = null;
          const sel = editor.getSelection ? editor.getSelection() : '';
          if (sel && sel.trim().length >= 2 && sel.trim().length <= 20) {
            term = sel.trim();
          } else if (editor.getCursor) {
            const cursor = editor.getCursor();
            const line = explicitLine || editor.getLine(cursor.line);
            if (line) {
              term = this.getWordAtCursor(line, cursor.ch);
            }
          }
          if (term && term.length >= 2 && term.length <= 15 && !parseRef(term)) {
            if (this._lastDictFollow !== term) {
              this._lastDictFollow = term;
              dictLeaf.view.searchAndSelect(term);
            }
          }
        }
      }

      // 2. 주석 찾기 자동 연동 (autoFollowEditor 활성 시)
      if (this.settings.autoFollowEditor) {
        let lineText = explicitLine;
        if (!lineText && editor.getCursor) {
          const cursor = editor.getCursor();
          lineText = editor.getLine(cursor.line);
        }
        if (!lineText || typeof lineText !== 'string') return;

        const r = parseRef(lineText);
        if (r) {
          const label = refLabel(r, this);
          if (this._lastEditorFollow !== label) {
            this._lastEditorFollow = label;
            const view = this.getView();
            if (view && typeof view.search === 'function') {
              if (view.current &&
                  view.current.b === r.b &&
                  view.current.ch === r.ch &&
                  view.current.v1 === r.v1 &&
                  view.current.v2 === r.v2 &&
                  view.resultsEl && view.resultsEl.querySelector('.scf-split-container')) {
                return;
              }
              if (view.inputEl) view.inputEl.value = label;
              view.search(label, true);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Commentary/Dictionary editor sync error:', e);
    }
  }

  getWordAtCursor(line, ch) {
    if (!line) return '';
    let start = Math.max(0, Math.min(ch, line.length));
    let end = start;
    while (start > 0 && /[가-힣a-zA-Z0-9]/.test(line[start - 1])) start--;
    while (end < line.length && /[가-힣a-zA-Z0-9]/.test(line[end])) end++;
    return line.substring(start, end).trim();
  }

  onunload() {
    if (this._legacyCheckTimer) {
      clearTimeout(this._legacyCheckTimer);
      this._legacyCheckTimer = null;
    }
    this.closeVersePopover();
  }

  closeVersePopover() {
    if (this._activePopoverTimer) {
      clearTimeout(this._activePopoverTimer);
      this._activePopoverTimer = null;
    }
    if (this._activePopoverOutsideListener) {
      document.removeEventListener('pointerdown', this._activePopoverOutsideListener);
      this._activePopoverOutsideListener = null;
    }
    if (this._activePopover) {
      this._activePopover.remove();
      this._activePopover = null;
    }
  }

  async showVersePopover(refStr, targetEl) {
    this.closeVersePopover();

    const parsedSingle = parseRef(refStr);
    const multi = parseMultiRef(refStr) || (parsedSingle ? {
      b: parsedSingle.b,
      bookRaw: BOOK_SHORT[parsedSingle.b] || BOOK_NAME[parsedSingle.b],
      segments: [{ ch: parsedSingle.ch, v1: parsedSingle.v1, v2: parsedSingle.v2 }],
      label: refLabel(parsedSingle, this)
    } : null);

    if (!multi || !multi.segments || !multi.segments.length) return;

    const formattedRef = multi.label || refStr;
    const lines = [];

    for (const seg of multi.segments) {
      const vText = await this.getKoreanBibleVerses(multi.b, seg.ch, seg.v1, seg.v2);
      if (vText && vText.trim()) {
        for (const line of vText.trim().split('\n')) {
          lines.push(line);
        }
      }
    }

    const popover = document.createElement('div');
    popover.className = 'scf-verse-popover';

    const popHead = popover.createDiv({ cls: 'scf-verse-pop-head' });
    const titleSpan = popHead.createSpan({ cls: 'scf-verse-pop-title' });
    titleSpan.setText(`📖 (${formattedRef})`);

    const popActions = popHead.createDiv({ cls: 'scf-verse-pop-actions' });

    const copyBtn = popActions.createEl('button', { cls: 'scf-verse-pop-btn', text: '📋' });
    copyBtn.title = '구절 복사';
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      const txt = lines.join('\n');
      navigator.clipboard.writeText(`(${formattedRef})\n${txt}`);
      new Notice(`📋 (${formattedRef}) 구절이 복사되었습니다.`);
    };

    const closeBtn = popActions.createEl('button', { cls: 'scf-verse-pop-btn', text: '✕' });
    closeBtn.title = '닫기';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closeVersePopover();
    };

    const popBody = popover.createDiv({ cls: 'scf-verse-pop-body' });
    if (lines.length > 0) {
      for (const line of lines) {
        const lineEl = popBody.createDiv({ cls: 'scf-verse-pop-line' });
        lineEl.setText(line);
      }
    } else {
      popBody.createDiv({ cls: 'scf-verse-pop-empty', text: '해당 구절의 성경 본문을 찾을 수 없습니다.' });
    }

    document.body.appendChild(popover);
    this._activePopover = popover;

    const rect = targetEl.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();

    let top = rect.bottom + 6;
    let left = rect.left;

    if (left + popRect.width > window.innerWidth - 16) {
      left = window.innerWidth - popRect.width - 16;
    }
    if (left < 16) left = 16;

    if (top + popRect.height > window.innerHeight - 16) {
      top = Math.max(16, rect.top - popRect.height - 6);
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    const outsideClickListener = (evt) => {
      if (this._activePopover && !this._activePopover.contains(evt.target) && evt.target !== targetEl) {
        this.closeVersePopover();
      }
    };
    this._activePopoverOutsideListener = outsideClickListener;
    this._activePopoverTimer = setTimeout(() => {
      this._activePopoverTimer = null;
      if (this._activePopover === popover) {
        document.addEventListener('pointerdown', outsideClickListener);
      }
    }, 10);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.rootOverrides) this.settings.rootOverrides = {};
    if (!this.settings.installedPacks) this.settings.installedPacks = {};
    if (!this.settings.chapterHashes) this.settings.chapterHashes = {};
  }
  async saveSettings() { await this.saveData(this.settings); }

  async listLegacyVaultDataFiles() {
    const dataDir = `${this.manifest.dir}/data`;
    try {
      if (!(await this.app.vault.adapter.exists(dataDir))) return [];
      const listed = await this.app.vault.adapter.list(dataDir);
      const files = (listed && Array.isArray(listed.files)) ? listed.files : [];
      return files.filter((f) => /(?:^|\/)b\d{2}\.json$/i.test(f));
    } catch (e) {
      return [];
    }
  }

  async cleanLegacyVaultDataFiles() {
    const legacyFiles = await this.listLegacyVaultDataFiles();
    let deleted = 0;
    for (const f of legacyFiles) {
      try {
        await this.app.vault.adapter.remove(f);
        deleted++;
      } catch (e) {
        console.warn('[주석 찾기] 구버전 파일 삭제 실패:', f, e);
      }
    }
    const dictPath = `${this.manifest.dir}/data/bible-dict.json`;
    try {
      if (await this.app.vault.adapter.exists(dictPath)) {
        await this.app.vault.adapter.remove(dictPath);
      }
    } catch (e) {}
    this._bookCache.clear();
    this._chapterCache.clear();
    this._bibleDict = null;
    await this.clearChapterCache(true);
    await this.syncRemoteData(false);
    new Notice(`✅ 구버전 주석 파일 ${deleted}개 정리 완료! 이제 GitHub 최신 데이터를 받아 사용합니다.`);
    return deleted;
  }

  async checkAndWarnLegacyData() {
    const legacyFiles = await this.listLegacyVaultDataFiles();
    if (!legacyFiles.length) return false;
    const dataRelPath = `${this.manifest.dir}/data/`;
    if (typeof document !== 'undefined' && typeof document.createDocumentFragment === 'function') {
      const frag = document.createDocumentFragment();
      const wrap = document.createElement('div');
      wrap.className = 'scf-legacy-notice';

      const msg = document.createElement('div');
      msg.textContent = `⚠️ [주석 찾기] 플러그인 폴더 안에 구버전 주석 파일 ${legacyFiles.length}개(b01~b66.json 등)가 남아 있어 GitHub 최신 복원본과 충돌할 수 있습니다. 아래 경로의 b01~b66.json 파일을 삭제해 주세요.`;
      wrap.appendChild(msg);

      const pathBox = document.createElement('div');
      pathBox.className = 'scf-legacy-notice-path';
      pathBox.textContent = `${dataRelPath} (b01~b66.json, bible-dict.json)`;
      wrap.appendChild(pathBox);

      const btnRow = document.createElement('div');
      btnRow.className = 'scf-legacy-notice-btns';
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️ 지금 자동 삭제 & 최신 동기화';
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '닫기';
      btnRow.appendChild(delBtn);
      btnRow.appendChild(closeBtn);
      wrap.appendChild(btnRow);
      frag.appendChild(wrap);

      const notice = new Notice(frag, 0);
      delBtn.onclick = async () => {
        delBtn.disabled = true;
        delBtn.textContent = '정리 중...';
        try {
          await this.cleanLegacyVaultDataFiles();
          notice.hide();
        } catch (err) {
          delBtn.disabled = false;
          delBtn.textContent = '🗑️ 지금 자동 삭제 & 최신 동기화';
          new Notice(`정리 실패: ${err.message}`);
        }
      };
      closeBtn.onclick = () => notice.hide();
    } else {
      new Notice(`⚠️ [주석 찾기] ${dataRelPath} 안의 구버전 b01~b66.json 파일(${legacyFiles.length}개)을 삭제해야 GitHub 최신본과 충돌하지 않습니다.`, 15000);
    }
    return true;
  }

  _getExternalFilePath(filename) {
    if (Platform && Platform.isMobile) return null;
    try {
      const fs = require('fs');
      const path = require('path');
      const basePath = this.app?.vault?.adapter?.basePath || (this.app?.vault?.adapter?.getBasePath ? this.app.vault.adapter.getBasePath() : '');
      const hasExplicitSetting = !!(this.settings && Object.prototype.hasOwnProperty.call(this.settings, 'externalDataDir'));
      const candidates = hasExplicitSetting
        ? [(this.settings.externalDataDir || '').trim()].filter(Boolean)
        : [
            DEFAULT_SETTINGS.externalDataDir,
            basePath ? path.resolve(basePath, '..', 'KHG_build', 'commentary_data') : '',
          ].filter(Boolean);
      for (const dir of candidates) {
        const full = path.join(dir, filename);
        if (fs.existsSync(full)) return full;
      }
    } catch (e) {}
    return null;
  }

  async loadBookData(b) {
    if (!b || b < 1 || b > 66) return null;
    if (this._bookCache.has(b)) return this._bookCache.get(b);
    try {
      const bStr = String(b).padStart(2, '0');
      const relPath = `${this.manifest.dir}/data/b${bStr}.json`;
      let data = null;
      if (await this.app.vault.adapter.exists(relPath)) {
        const raw = await this.app.vault.adapter.read(relPath);
        data = JSON.parse(raw);
      } else {
        const extPath = this._getExternalFilePath(`b${bStr}.json`);
        if (extPath) {
          const fs = require('fs');
          const raw = fs.readFileSync(extPath, 'utf8');
          data = JSON.parse(raw);
          if (data) data._externalBookPath = extPath;
        }
      }
      if (!data) return null;
      // 최근 4권 캐시 유지
      if (this._bookCache.size >= 4) {
        const firstKey = this._bookCache.keys().next().value;
        this._bookCache.delete(firstKey);
      }
      this._bookCache.set(b, data);
      return data;
    } catch (e) {
      return null;
    }
  }

  getDataRawBaseUrl() {
    const repo = (this.settings.dataRepo || DEFAULT_SETTINGS.dataRepo || '')
      .trim()
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\/+$/, '');
    const branch = (this.settings.dataBranch || DEFAULT_SETTINGS.dataBranch || 'main').trim() || 'main';
    return repo ? `https://raw.githubusercontent.com/${repo}/${branch}` : '';
  }

  async ensureVaultDir(relDir) {
    const parts = String(relDir || '').split('/').filter(Boolean);
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      try {
        if (!(await this.app.vault.adapter.exists(cur))) {
          await this.app.vault.adapter.mkdir(cur);
        }
      } catch (e) {
        // 이미 생성된 경우 무시
      }
    }
  }

  async fetchRawJson(relPath, timeoutMs = 20000) {
    const base = this.getDataRawBaseUrl();
    if (!base) throw new Error('데이터 저장소(GitHub)가 설정되지 않았습니다.');
    const url = `${base}/${String(relPath || '').replace(/^\/+/, '')}`;
    const reqPromise = requestUrl({ url, method: 'GET' });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`요청 시간 초과 (${timeoutMs}ms): ${relPath}`)), timeoutMs)
    );
    const res = await Promise.race([reqPromise, timeoutPromise]);
    if (res && typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
      throw new Error(`HTTP ${res.status}: ${relPath}`);
    }
    const rawText = res && typeof res.text === 'string' && res.text.length > 0
      ? res.text
      : (res && res.json !== undefined ? JSON.stringify(res.json) : '');
    const data = res && res.json !== undefined && typeof res.text !== 'string'
      ? res.json
      : JSON.parse(rawText);
    return { data, rawText };
  }

  async loadLocalManifest() {
    try {
      const path = `${this.manifest.dir}/data/chapters_manifest.json`;
      if (await this.app.vault.adapter.exists(path)) {
        const raw = await this.app.vault.adapter.read(path);
        this._manifestData = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[주석 찾기] 로컬 chapters_manifest.json 읽기 실패', e);
    }
  }

  async loadLocalPacksManifest() {
    try {
      const p = `${this.manifest.dir}/data/packs_manifest.json`;
      if (await this.app.vault.adapter.exists(p)) {
        const raw = await this.app.vault.adapter.read(p);
        this._packsManifestData = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[주석 찾기] 로컬 packs_manifest.json 읽기 실패', e);
    }
  }

  _getPackStorageRoot() {
    if (Platform && Platform.isMobile) return null;
    if (typeof require !== 'function') return null;
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const configured = (this.settings && this.settings.externalDataDir ? this.settings.externalDataDir : '').trim();
      const basePath = this.app?.vault?.adapter?.basePath || (this.app?.vault?.adapter?.getBasePath ? this.app.vault.adapter.getBasePath() : '');
      if (configured) {
        const isCustom = configured !== DEFAULT_SETTINGS.externalDataDir;
        if (isCustom || fs.existsSync(configured) || fs.existsSync(path.dirname(configured))) {
          return configured;
        }
      }
      if (basePath) {
        const siblingBuild = path.resolve(basePath, '..', 'KHG_build', 'commentary_data');
        if (fs.existsSync(siblingBuild)) return siblingBuild;
      }
      return path.join(os.homedir(), '.sermon-commentary-data');
    } catch (e) {}
    return null;
  }

  getPackReleaseAssetUrl(fileName, manifest = null) {
    const repo = (this.settings.dataRepo || DEFAULT_SETTINGS.dataRepo || '')
      .trim()
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\/+$/, '');
    if (!repo) throw new Error('데이터 저장소(GitHub)가 설정되지 않았습니다.');
    const tag = (manifest && manifest.releaseTag) || (this._packsManifestData && this._packsManifestData.releaseTag) || 'packs-latest';
    return `https://github.com/${repo}/releases/download/${tag}/${String(fileName || '').replace(/^\/+/, '')}`;
  }

  async fetchPacksManifest(showError = false) {
    let manifest = null;
    let rawText = '';
    try {
      const res = await this.fetchRawJson('packs_manifest.json', 12000);
      manifest = res.data;
      rawText = res.rawText;
    } catch (e) {
      try {
        const url = this.getPackReleaseAssetUrl('packs_manifest.json', { releaseTag: 'packs-latest' });
        const reqPromise = requestUrl({ url, method: 'GET' });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('packs_manifest 요청 시간 초과')), 12000));
        const res = await Promise.race([reqPromise, timeoutPromise]);
        if (res && res.status >= 200 && res.status < 300) {
          rawText = typeof res.text === 'string' && res.text ? res.text : JSON.stringify(res.json);
          manifest = typeof res.json === 'object' && res.json ? res.json : JSON.parse(rawText);
        }
      } catch (e2) {
        if (showError) throw e2;
      }
    }
    if (!manifest || !manifest.packs) {
      if (showError) throw new Error('packs_manifest.json 형식이 올바르지 않습니다.');
      return null;
    }
    this._packsManifestData = manifest;
    try {
      await this.ensureVaultDir(`${this.manifest.dir}/data`);
      await this.app.vault.adapter.write(`${this.manifest.dir}/data/packs_manifest.json`, rawText || JSON.stringify(manifest));
    } catch (_) {}
    return manifest;
  }

  async installPack(sid, onProgress = null) {
    const manifest = this._packsManifestData || await this.fetchPacksManifest(true);
    const packInfo = manifest && manifest.packs ? manifest.packs[sid] : null;
    if (!packInfo || !packInfo.file) {
      throw new Error(`릴리즈 목록에서 팩(${sid})을 찾을 수 없습니다.`);
    }
    if (!this.index) {
      try { await this.fetchAndSaveIndex(); } catch (_) {}
    }

    const url = this.getPackReleaseAssetUrl(packInfo.file, manifest);
    onProgress?.(`다운로드 중 (${formatBytesMb(packInfo.zipBytes)})...`);
    const timeoutMs = Math.max(45000, Math.round((packInfo.zipBytes || 0) / 1024 / 20));
    const reqPromise = requestUrl({ url, method: 'GET' });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`다운로드 시간 초과 (${packInfo.file})`)), timeoutMs)
    );
    const res = await Promise.race([reqPromise, timeoutPromise]);
    if (res && typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
      throw new Error(`HTTP ${res.status}: ${packInfo.file}`);
    }
    const ab = res && res.arrayBuffer;
    if (!ab || !ab.byteLength) throw new Error(`빈 응답 파일입니다 (${packInfo.file})`);

    const u8 = new Uint8Array(ab);
    const entries = parseZipCentralDirectory(u8).filter((e) => !e.name.endsWith('/'));
    if (!entries.length) throw new Error(`압축 파일에 JSON 데이터가 없습니다 (${packInfo.file})`);

    const isMobile = !!(Platform && Platform.isMobile) || typeof require !== 'function';
    const rootDir = isMobile ? null : this._getPackStorageRoot();
    let writtenCount = 0;

    if (!isMobile && rootDir) {
      const fs = require('fs');
      const path = require('path');
      const packDir = path.join(rootDir, 'packs', sid);
      fs.mkdirSync(packDir, { recursive: true });
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const baseName = path.posix.basename(entry.name);
        if (!baseName || baseName.includes('..')) continue;
        if (i === 0 || (i + 1) % 5 === 0 || i + 1 === entries.length) {
          onProgress?.(`해제 중 (${i + 1}/${entries.length})`);
        }
        const bytes = await extractZipEntryBytes(u8, entry);
        fs.writeFileSync(path.join(packDir, baseName), bytes);
        writtenCount++;
      }
    } else {
      const packRelDir = `${this.manifest.dir}/data/packs/${sid}`;
      await this.ensureVaultDir(packRelDir);
      const dec = new TextDecoder('utf-8');
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const baseName = entry.name.split('/').pop();
        if (!baseName || baseName.includes('..')) continue;
        onProgress?.(`해제 중 (${i + 1}/${entries.length}: ${baseName})`);
        const bytes = await extractZipEntryBytes(u8, entry);
        await this.app.vault.adapter.write(`${packRelDir}/${baseName}`, dec.decode(bytes));
        writtenCount++;
        if (i % 3 === 2) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    this._packBookCache.clear();
    this._chapterCache.clear();
    this._bookCache.clear();
    if (sid === 'bible-dict') this._bibleDict = null;

    if (!this.settings.installedPacks) this.settings.installedPacks = {};
    this.settings.installedPacks[sid] = {
      hash: packInfo.hash || '',
      zipBytes: packInfo.zipBytes || u8.length,
      rawBytes: packInfo.rawBytes || 0,
      fileCount: writtenCount,
      installedAt: new Date().toISOString(),
      storage: isMobile ? 'vault' : (rootDir || 'vault'),
    };
    await this.saveSettings();
    return { sid, writtenCount };
  }

  async uninstallPack(sid) {
    const isMobile = !!(Platform && Platform.isMobile) || typeof require !== 'function';
    if (!isMobile) {
      const rootDir = this._getPackStorageRoot();
      if (rootDir) {
        try {
          const fs = require('fs');
          const path = require('path');
          const packDir = path.join(rootDir, 'packs', sid);
          if (fs.existsSync(packDir)) {
            fs.rmSync(packDir, { recursive: true, force: true });
          }
        } catch (e) {
          console.warn('[주석 찾기] PC 팩 폴더 삭제 실패:', sid, e);
        }
      }
    }
    const vaultPackDir = `${this.manifest.dir}/data/packs/${sid}`;
    try {
      if (await this.app.vault.adapter.exists(vaultPackDir)) {
        const listed = await this.app.vault.adapter.list(vaultPackDir);
        const files = (listed && listed.files) ? listed.files : [];
        for (const f of files) {
          try { await this.app.vault.adapter.remove(f); } catch (_) {}
        }
        if (typeof this.app.vault.adapter.rmdir === 'function') {
          try { await this.app.vault.adapter.rmdir(vaultPackDir, true); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[주석 찾기] 보관함 팩 삭제 실패:', sid, e);
    }

    if (this.settings.installedPacks) {
      delete this.settings.installedPacks[sid];
    }
    this._packBookCache.clear();
    this._chapterCache.clear();
    this._bookCache.clear();
    if (sid === 'bible-dict') this._bibleDict = null;
    await this.saveSettings();
    return true;
  }

  async _loadPackBookData(sid, bStr) {
    const key = `${sid}:${bStr}`;
    if (this._packBookCache.has(key)) {
      const hit = this._packBookCache.get(key);
      this._packBookCache.delete(key);
      this._packBookCache.set(key, hit);
      return hit;
    }
    let data = null;
    if (!(Platform && Platform.isMobile) && typeof require === 'function') {
      const rootDir = this._getPackStorageRoot();
      if (rootDir) {
        try {
          const fs = require('fs');
          const path = require('path');
          const full = path.join(rootDir, 'packs', sid, `b${bStr}.json`);
          if (fs.existsSync(full)) {
            data = JSON.parse(fs.readFileSync(full, 'utf8'));
          }
        } catch (_) {}
      }
    }
    if (!data) {
      const rel = `${this.manifest.dir}/data/packs/${sid}/b${bStr}.json`;
      try {
        if (await this.app.vault.adapter.exists(rel)) {
          data = JSON.parse(await this.app.vault.adapter.read(rel));
        }
      } catch (_) {}
    }
    if (data) {
      if (this._packBookCache.size >= 8) {
        const oldest = this._packBookCache.keys().next().value;
        this._packBookCache.delete(oldest);
      }
      this._packBookCache.set(key, data);
    }
    return data;
  }

  _getPackableSourcesForChapter(b, chNum) {
    if (!this.index || !Array.isArray(this.index.files)) return null;
    const entries = [];
    if (this.lookup && typeof this.lookup.get === 'function') {
      const chList = this.lookup.get(`${b}:${chNum}`);
      if (Array.isArray(chList)) entries.push(...chList);
      if (chNum !== 0) {
        const ch0List = this.lookup.get(`${b}:0`);
        if (Array.isArray(ch0List)) entries.push(...ch0List);
      }
    }
    const sids = new Set();
    for (const e of entries) {
      const fInfo = this.index.files[e[4]];
      const sid = fInfo && fInfo[0];
      if (sid && PACKABLE_COMMENTARY_IDS.has(sid)) sids.add(sid);
    }
    return sids;
  }

  _mergeBookFields(target, src, overwrite = false) {
    if (!src || typeof src !== 'object') return;
    if (src.pages) {
      for (const [k, v] of Object.entries(src.pages)) {
        if (overwrite || !(k in target.pages)) target.pages[k] = v;
      }
    }
    if (src.corrected) {
      for (const [k, v] of Object.entries(src.corrected)) {
        if (overwrite || !(k in target.corrected)) target.corrected[k] = v;
      }
    }
  }

  async syncRemoteManifestSilent() {
    try {
      const { data: remote, rawText } = await this.fetchRawJson('chapters_manifest.json', 10000);
      if (!remote || !remote.chapters) return;
      const prevHash = this._manifestData ? this._manifestData.indexHash : null;
      await this.ensureVaultDir(`${this.manifest.dir}/data`);
      await this.app.vault.adapter.write(`${this.manifest.dir}/data/chapters_manifest.json`, rawText || JSON.stringify(remote));
      this._manifestData = remote;
      const indexPath = `${this.manifest.dir}/${INDEX_FILE}`;
      const indexMissing = !(await this.app.vault.adapter.exists(indexPath));
      if (indexMissing || (remote.indexHash && remote.indexHash !== prevHash)) {
        await this.fetchAndSaveIndex();
      }
    } catch (e) {
      // 오프라인 또는 저장소 미연결 시 조용히 무시
    }
  }

  _setChapterCache(cacheKey, data) {
    if (this._chapterCache.has(cacheKey)) {
      this._chapterCache.delete(cacheKey);
    } else if (this._chapterCache.size >= 24) {
      const firstKey = this._chapterCache.keys().next().value;
      this._chapterCache.delete(firstKey);
    }
    this._chapterCache.set(cacheKey, data);
  }

  async loadChapterData(b, ch) {
    if (!b || b < 1 || b > 66) return null;
    const chNum = (ch === undefined || ch === null || Number.isNaN(Number(ch))) ? 0 : Number(ch);
    const bStr = String(b).padStart(2, '0');
    const cacheKey = `${b}-${chNum}`;
    const manifestEntry = this._manifestData && this._manifestData.chapters ? this._manifestData.chapters[cacheKey] : null;
    const expectedHash = manifestEntry && manifestEntry.h ? manifestEntry.h : null;
    const savedHash = this.settings.chapterHashes ? this.settings.chapterHashes[cacheKey] : null;
    const isStale = !!(expectedHash && savedHash && expectedHash !== savedHash);

    if (!isStale && this._chapterCache.has(cacheKey)) {
      const cached = this._chapterCache.get(cacheKey);
      this._setChapterCache(cacheKey, cached);
      return cached;
    }

    const localChapterPath = `${this.manifest.dir}/data/chapters/b${bStr}-${chNum}.json`;
    const localLegacyPath = `${this.manifest.dir}/data/b${bStr}.json`;
    const isMobile = !!(Platform && Platform.isMobile);

    const installedCommentaries = Object.keys(this.settings?.installedPacks || {})
      .filter((sid) => PACKABLE_COMMENTARY_IDS.has(sid));
    const hasInstalledPacks = installedCommentaries.length > 0;
    const packsOnly = Boolean(this.settings?.installedPacksOnly);

    if (hasInstalledPacks || packsOnly) {
      const merged = { b, pages: {}, corrected: {}, _fromPacks: true };
      const neededSources = this._getPackableSourcesForChapter(b, chNum);
      const targetSids = (neededSources && neededSources.size > 0)
        ? installedCommentaries.filter((sid) => neededSources.has(sid))
        : installedCommentaries;

      for (const sid of targetSids) {
        const packBook = await this._loadPackBookData(sid, bStr);
        if (packBook) this._mergeBookFields(merged, packBook, true);
      }

      const installedSet = new Set(installedCommentaries);
      const allCoveredByPacks = Boolean(
        neededSources && neededSources.size > 0 && [...neededSources].every((sid) => installedSet.has(sid))
      );

      let localChData = null;
      try {
        if (await this.app.vault.adapter.exists(localChapterPath)) {
          localChData = JSON.parse(await this.app.vault.adapter.read(localChapterPath));
        }
      } catch (_) {}

      const missingSources = !allCoveredByPacks && !packsOnly;
      if (missingSources) {
        let fallbackData = null;
        if (!isMobile) {
          try { fallbackData = await this.loadBookData(b); } catch (_) {}
        }
        if (!fallbackData && !isStale && localChData) {
          fallbackData = localChData;
        }
        if (!fallbackData) {
          const remoteRel = (manifestEntry && manifestEntry.f) ? manifestEntry.f : `chapters/b${bStr}-${chNum}.json`;
          try {
            const { data, rawText } = await this.fetchRawJson(remoteRel, 25000);
            if (data) {
              fallbackData = data;
              await this.ensureVaultDir(`${this.manifest.dir}/data/chapters`);
              await this.app.vault.adapter.write(localChapterPath, rawText || JSON.stringify(data));
              if (expectedHash) {
                if (!this.settings.chapterHashes) this.settings.chapterHashes = {};
                this.settings.chapterHashes[cacheKey] = expectedHash;
                await this.saveSettings();
              }
            }
          } catch (_) {
            if (localChData) fallbackData = localChData;
            else if (isMobile && await this.app.vault.adapter.exists(localLegacyPath)) {
              fallbackData = await this.loadBookData(b);
            }
          }
        }
        if (fallbackData) {
          this._mergeBookFields(merged, fallbackData, false);
        }
      }

      if (localChData && localChData._userCorrected && localChData.corrected) {
        if (!merged._userCorrected) merged._userCorrected = {};
        for (const [uk, isUsr] of Object.entries(localChData._userCorrected)) {
          if (isUsr && uk in localChData.corrected) {
            merged.corrected[uk] = localChData.corrected[uk];
            merged._userCorrected[uk] = true;
          }
        }
      }

      this._setChapterCache(cacheKey, merged);
      return merged;
    }

    // 1. 로컬 장 캐시 파일 확인 (최신 해시와 일치하거나 매니페스트 없을 때)
    if (!isStale) {
      try {
        if (await this.app.vault.adapter.exists(localChapterPath)) {
          const raw = await this.app.vault.adapter.read(localChapterPath);
          const data = JSON.parse(raw);
          if (data) data._isChapterOnly = true;
          this._setChapterCache(cacheKey, data);
          return data;
        }
      } catch (e) {
        console.warn('[주석 찾기] 로컬 장 파일 읽기 실패', localChapterPath, e);
      }
    }

    // 2. PC 데스크톱은 로컬 또는 외부(KHG 밖) 전체 권 JSON(b{NN}.json)을 우선 사용
    if (!isMobile) {
      try {
        const legacyData = await this.loadBookData(b);
        if (legacyData) return legacyData;
      } catch (e) {
        // 무시 후 원격 온디맨드 다운로드 시도
      }
    }

    // 3. GitHub에서 해당 장 JSON만 온디맨드 다운로드 (모바일에서는 구형 Sync 잔존 파일보다 항상 우선)
    const remoteRel = (manifestEntry && manifestEntry.f) ? manifestEntry.f : `chapters/b${bStr}-${chNum}.json`;
    try {
      const { data, rawText } = await this.fetchRawJson(remoteRel, 25000);
      if (data) {
        data._isChapterOnly = true;
        await this.ensureVaultDir(`${this.manifest.dir}/data/chapters`);
        await this.app.vault.adapter.write(localChapterPath, rawText || JSON.stringify(data));
        if (expectedHash) {
          if (!this.settings.chapterHashes) this.settings.chapterHashes = {};
          this.settings.chapterHashes[cacheKey] = expectedHash;
          await this.saveSettings();
        }
        this._setChapterCache(cacheKey, data);
        return data;
      }
    } catch (e) {
      console.warn('[주석 찾기] 원격 장 다운로드 실패:', remoteRel, e);
    }

    // 4. 오프라인 fallback: 만료된 장 캐시 또는 (모바일 오프라인 시) 로컬 전체 권 JSON 사용
    try {
      if (await this.app.vault.adapter.exists(localChapterPath)) {
        const raw = await this.app.vault.adapter.read(localChapterPath);
        const data = JSON.parse(raw);
        if (data) data._isChapterOnly = true;
        this._setChapterCache(cacheKey, data);
        return data;
      }
      if (isMobile && await this.app.vault.adapter.exists(localLegacyPath)) {
        const legacyData = await this.loadBookData(b);
        if (legacyData) return legacyData;
      }
    } catch (e) {
      // 무시
    }
    return null;
  }

  async syncRemoteData(showNotice = true) {
    try {
      if (showNotice) new Notice('GitHub에서 최신 색인 및 복원 목록을 확인하는 중...');
      const { data: remote, rawText: manifestRaw } = await this.fetchRawJson('chapters_manifest.json', 15000);
      if (!remote || !remote.chapters) throw new Error('chapters_manifest.json 형식이 올바르지 않습니다.');

      await this.ensureVaultDir(`${this.manifest.dir}/data`);
      await this.app.vault.adapter.write(`${this.manifest.dir}/data/chapters_manifest.json`, manifestRaw || JSON.stringify(remote));
      this._manifestData = remote;

      await this.fetchAndSaveIndex();

      // 해시가 바뀐 로컬 장 캐시 정리
      let invalidated = 0;
      if (this.settings.chapterHashes) {
        for (const [k, oldH] of Object.entries(this.settings.chapterHashes)) {
          const entry = remote.chapters[k];
          if (entry && entry.h && entry.h !== oldH) {
            this._chapterCache.delete(k);
            const [kb, kch] = k.split('-');
            const p = `${this.manifest.dir}/data/chapters/b${String(kb).padStart(2, '0')}-${kch}.json`;
            try {
              if (await this.app.vault.adapter.exists(p)) await this.app.vault.adapter.remove(p);
            } catch (e) { /* 무시 */ }
            delete this.settings.chapterHashes[k];
            invalidated++;
          }
        }
        if (invalidated > 0) await this.saveSettings();
      }

      if (Platform && Platform.isMobile) {
        await this._cleanupMobileLegacyBookFiles();
      }

      if (showNotice) {
        new Notice(`동기화 완료: ${remote.count || Object.keys(remote.chapters).length}개 장 최신화 (갱신된 캐시 ${invalidated}건 정리)`);
      }
      return true;
    } catch (e) {
      console.error('[주석 찾기] 원격 데이터 동기화 실패', e);
      if (showNotice) new Notice(`동기화 실패: ${e.message || e}`);
      return false;
    }
  }

  async _cleanupMobileLegacyBookFiles() {
    if (!(Platform && Platform.isMobile)) return 0;
    let removed = 0;
    const dataDir = `${this.manifest.dir}/data`;
    try {
      if (await this.app.vault.adapter.exists(dataDir)) {
        const listed = await this.app.vault.adapter.list(dataDir);
        const files = (listed && listed.files) ? listed.files : [];
        for (const f of files) {
          const base = f.split('/').pop();
          if (/^b\d{2}\.json$/i.test(base)) {
            await this.app.vault.adapter.remove(f);
            removed++;
          }
        }
      }
    } catch (e) {
      console.warn('[주석 찾기] 모바일 구형 데이터 정리 실패', e);
    }
    return removed;
  }

  async clearChapterCache(silent = false) {
    this._chapterCache.clear();
    this._bookCache.clear();
    let removed = 0;
    const chaptersDir = `${this.manifest.dir}/data/chapters`;
    try {
      if (await this.app.vault.adapter.exists(chaptersDir)) {
        const listed = await this.app.vault.adapter.list(chaptersDir);
        const files = (listed && listed.files) ? listed.files : [];
        for (const f of files) {
          if (f.endsWith('.json')) {
            await this.app.vault.adapter.remove(f);
            removed++;
          }
        }
      }
    } catch (e) {
      console.warn('[주석 찾기] 캐시 파일 삭제 실패', e);
    }
    if (Platform && Platform.isMobile) {
      removed += await this._cleanupMobileLegacyBookFiles();
    }
    this.settings.chapterHashes = {};
    await this.saveSettings();
    if (!silent) {
      new Notice(`장 캐시 비우기 완료: ${removed}개 파일 삭제`);
    }
  }

  async getKoreanBibleVerses(b, ch, v1, v2) {
    try {
      const bf = this.app.plugins?.plugins?.['obsidian-bible-finder'] || this.app.plugins?.plugins?.['obsidian-bible-bible-finder'];
      if (bf && bf.bibles) {
        let korVer = null;
        // 1순위: 순수 '개역한글' (한문/국한문 절대 제외)
        for (const [k, v] of bf.bibles.entries()) {
          const n = (v?.name || '').trim();
          if ((n === '개역한글' || n === '개역한글.btx') && !n.includes('한문') && !n.includes('국한문')) {
            korVer = v; break;
          }
        }
        if (!korVer) {
          for (const [k, v] of bf.bibles.entries()) {
            const n = (v?.name || '').trim();
            if (n.includes('개역한글') && !n.includes('한문') && !n.includes('국한문')) {
              korVer = v; break;
            }
          }
        }
        if (!korVer && bf.getActiveVersion) {
          const act = bf.getActiveVersion();
          if (act && !act.name.includes('한문') && !act.name.includes('국한문')) korVer = act;
        }
        if (korVer && korVer.index) {
          const shortName = BOOK_SHORT[b];
          const fullName = BOOK_NAME[b];
          const bMap = korVer.index.get(shortName) || korVer.index.get(fullName);
          if (bMap) {
            const chapMap = bMap.get(ch);
            if (chapMap) {
              const lines = [];
              const startV = v1 && v1 > 0 ? v1 : 1;
              const endV = v2 && v2 >= startV ? v2 : (v1 > 0 ? v1 : chapMap.size);
              for (let v = startV; v <= endV; v++) {
                const vObj = chapMap.get(v);
                const txt = vObj?.content || vObj?.text;
                if (txt) lines.push(`${ch}:${v} ${txt.trim()}`);
              }
              if (lines.length) return lines.join('\n');
            }
          }
        }
      }

      // Fallback: vault 내 _bibles/개역한글.btx 직접 파싱 (순수 개역한글 최우선, iPadOS/모바일 호환)
      if (!this._btxLines) {
        const btxCandidates = ['_bibles/개역한글.btx', '_bibles/개역개정4판.btx'];
        for (const cand of btxCandidates) {
          if (await this.app.vault.adapter.exists(cand)) {
            const raw = await this.app.vault.adapter.read(cand);
            this._btxLines = raw.split(/\r?\n/);
            break;
          }
        }
      }
      if (this._btxLines) {
        const bStr = String(b).padStart(2, '0');
        const short = BOOK_SHORT[b];
        const prefix = `${bStr}${short} ${ch}:`;
        const lines = [];
        const startV = v1 && v1 > 0 ? v1 : 1;
        const endV = v2 && v2 >= startV ? v2 : (v1 > 0 ? v1 : 999);
        for (const line of this._btxLines) {
          if (!line.startsWith(prefix)) continue;
          const m = line.substring(prefix.length).match(/^(\d+)\s*(.*)$/);
          if (m) {
            const vn = parseInt(m[1], 10);
            if (vn >= startV && vn <= endV) {
              lines.push(`${ch}:${vn} ${m[2].trim()}`);
            }
          }
        }
        if (lines.length) return lines.join('\n');
      }
      return '';
    } catch (e) {
      console.warn('개역한글 본문 조회 실패:', e);
      return '';
    }
  }

  async proofreadWithAI(refText, korBibleText, ocrText) {
    const s = this.settings;
    let apiKey = s.geminiApiKey?.trim();
    if (!apiKey) {
      try {
        const smm = this.app.plugins?.plugins?.['sermon-mindmap'];
        apiKey = smm?.settings?.geminiApiKey?.trim();
      } catch (e) {}
    }
    if (!apiKey) {
      try {
        const path = '.obsidian/plugins/sermon-mindmap/data.json';
        if (await this.app.vault.adapter.exists(path)) {
          const raw = await this.app.vault.adapter.read(path);
          const d = JSON.parse(raw);
          if (d && d.geminiApiKey) apiKey = d.geminiApiKey.trim();
        }
      } catch (e) {}
    }
    if (!apiKey) {
      new Notice('Gemini API 키가 없습니다. [설정 > 주석 찾기] 또는 [설교 마인드맵] 설정에 무료 API 키를 넣어주세요.');
      return null;
    }

    const prompt = `당신은 최고 수준의 기독교 신학 문헌 및 성경 주석 전문 교정가입니다.
제공된 [OCR 주석 원문]은 인쇄본 스캔 OCR 과정에서 발생한 오탈자, 깨진 문자, 부자연스러운 줄바꿈이 포함되어 있습니다.
반드시 함께 제공된 [개역한글 성경 원문]을 '절대적 기준'으로 대조하여 완벽하게 교정하십시오.

[교정 원칙]
1. 성경 본문 인용구: 주석 본문 안에 인용된 성경 구절(말씀 본문)은 제공된 [개역한글 성경 원문]과 대조하여 토씨 하나 틀림없이 100% 개역한글 원형 그대로 완벽히 복원하십시오. (임의로 개역개정이나 현대어로 수정하지 마십시오)
2. 히브리어 및 헬라어 원어 복원: 주석 원본(옥스퍼드 원어대전 등)에 인쇄되어 있던 히브리어/헬라어 원어가 스캔 OCR 프로그램의 원어 폰트 미지원으로 인해 깨진 영어 난수(예: '.åavL8', 'uios', 'πO T' 등)는 신학 지식에 근거하여 올바른 히브리어(예: דָּוִד, זִמָּה 등) 또는 헬라어 원문(예: Δαυίδ, υἱός 등), 그리고 정확한 한글 음역으로 복원하십시오.
3. 한글 뒤 한자/영문 병기 및 괄호 깨짐(C -> () 정밀 복원:
   - 주석 원문에는 '믿음(信仰)', '은혜(恩惠)' 등 '한글(한자)' 형태의 한자 병기가 대단히 많습니다.
   - 여는 괄호 '('가 영문 대문자 'C' 또는 'c'로 오인식된 오류(예: '믿음C信仰)' → '믿음(信仰)')를 문맥에 맞는 바른 여는 괄호 '('로 교정하십시오.
4. 신학 및 강해 해설: 신학적 맥락과 문맥을 바탕으로 명백한 OCR 오탈자를 바르게 교정하십시오.
5. 문단 및 본문 흐름 복원:
   - 2단 인쇄로 끊긴 가짜 줄바꿈을 문단 단위로 매끄럽게 연결하십시오.
   - [박스/도표/특강 분리 격리] 주석 본문 중간에 [고고학적 배경], [성경 인물 연구], [단어 사전], [도표], [특강] 등 상자(박스) 기사가 끼어들어 본문 문맥이 잘려 있는 경우, 박스 때문에 끊어진 본문 문맥을 먼저 하나로 자연스럽게 잇고, 해당 박스 기사는 본문 뒤에 옵시디언 콜아웃 상자('> [!note] 박스 제목')로 독립 격리하여 배치하십시오.
6. 옥스퍼드 원어대전 원어 분해 및 도표 서식:
   - 옥스퍼드 원어대전의 원어 분해 항목([원어], [한글음역], [스트롱코드/문법], [의미/해석])은 어지러운 줄글 대신 가독성 높은 마크다운 표('| 원어 | 음역 | 문법 | 의미 |')나 정돈된 블록으로 깔끔하게 레이아웃하십시오.
   - 도표는 표준 마크다운 표('| 컬럼 | 컬럼 |')로 변환하십시오.
7. 'QoT 제목' 또는 'QoT 체목' 등은 반드시 'QT 제목'으로 바르게 수정하고, 앞뒤로 빈 줄(줄바꿈)을 넣어 가독성 있게 독립 단락으로 구분하십시오.
8. 출력 형식: 부가적인 인사말, 서론, 교정 내역 설명 등은 일체 포함하지 말고, 오직 '교정 완료된 주석 텍스트 전문'만 출력하십시오.

[개역한글 성경 원문 (${refText})]
${korBibleText || '(개역한글 본문 없음)'}

[교정할 OCR 주석 원문]
${ocrText}`;

    const models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash'];
    let lastErr = null;
    for (const m of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
          })
        });
        if (resp.status === 200) {
          const resJson = await resp.json();
          const candidate = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) return formatCommentaryText(candidate.trim());
        } else {
          const errTxt = await resp.text();
          lastErr = new Error(`API 오류 (${m} ${resp.status}): ${errTxt.substring(0, 100)}`);
          // 503이나 429일 경우 다음 모델로 자동 시도
          continue;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
    return null;
  }

  async saveCorrectedText(b, key, text, ch = null) {
    const bStr = String(b).padStart(2, '0');
    const legacyPath = `${this.manifest.dir}/data/b${bStr}.json`;
    const targetData = (ch !== null && ch !== undefined)
      ? await this.loadChapterData(b, ch)
      : await this.loadBookData(b);
    if (!targetData) return;
    if (!targetData.corrected) targetData.corrected = {};
    if (!targetData._userCorrected) targetData._userCorrected = {};
    targetData.corrected[key] = text;
    targetData._userCorrected[key] = true;
    try {
      if (!targetData._isChapterOnly && !targetData._fromPacks && await this.app.vault.adapter.exists(legacyPath)) {
        await this.app.vault.adapter.write(legacyPath, JSON.stringify(targetData));
      } else if (ch !== null && ch !== undefined) {
        await this.ensureVaultDir(`${this.manifest.dir}/data/chapters`);
        await this.app.vault.adapter.write(`${this.manifest.dir}/data/chapters/b${bStr}-${ch}.json`, JSON.stringify(targetData));
      }
    } catch (e) {
      console.error('교정 데이터 저장 실패', e);
    }
  }

  _buildIndexMaps(data) {
    this.index = data;
    this.lookup = new Map();
    this.bookLookup = new Map();
    if (!data || !Array.isArray(data.entries)) return;
    for (const e of data.entries) {
      const k = `${e[0]}:${e[1]}`;
      let arr = this.lookup.get(k);
      if (!arr) { arr = []; this.lookup.set(k, arr); }
      arr.push(e);

      let barr = this.bookLookup.get(e[0]);
      if (!barr) { barr = []; this.bookLookup.set(e[0], barr); }
      barr.push(e);
    }
  }

  async fetchAndSaveIndex() {
    const { data, rawText } = await this.fetchRawJson(INDEX_FILE, 30000);
    if (!data || !Array.isArray(data.entries)) {
      throw new Error('commentary-index.json 형식이 올바르지 않습니다.');
    }
    await this.ensureVaultDir(this.manifest.dir);
    await this.app.vault.adapter.write(`${this.manifest.dir}/${INDEX_FILE}`, rawText || JSON.stringify(data));
    this._buildIndexMaps(data);
    return data;
  }

  async loadIndex() {
    const path = `${this.manifest.dir}/${INDEX_FILE}`;
    try {
      if (await this.app.vault.adapter.exists(path)) {
        const raw = await this.app.vault.adapter.read(path);
        const data = JSON.parse(raw);
        this._buildIndexMaps(data);
        return;
      }
    } catch (e) {
      console.error('[주석 찾기] 로컬 색인 불러오기 실패', e);
      this.index = null;
    }

    // BRAT 신규 설치 등 로컬 색인이 없으면 GitHub 데이터 저장소에서 자동 내려받기
    try {
      new Notice('주석 색인(약 3MB)을 처음 내려받는 중입니다...');
      try {
        const { data: remoteManifest, rawText: manifestRaw } = await this.fetchRawJson('chapters_manifest.json', 15000);
        if (remoteManifest && remoteManifest.chapters) {
          await this.ensureVaultDir(`${this.manifest.dir}/data`);
          await this.app.vault.adapter.write(`${this.manifest.dir}/data/chapters_manifest.json`, manifestRaw || JSON.stringify(remoteManifest));
          this._manifestData = remoteManifest;
        }
      } catch (manifestErr) {
        console.warn('[주석 찾기] 초기 매니페스트 다운로드 생략:', manifestErr);
      }
      await this.fetchAndSaveIndex();
      new Notice('주석 색인 준비 완료! 성경 장을 선택하면 해당 장만 자동으로 내려받습니다.');
    } catch (e) {
      console.error('[주석 찾기] 원격 색인 불러오기 실패', e);
      this.index = null;
    }
  }

  getView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    return leaves.length ? leaves[0].view : null;
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }

  async findFor(text) {
    const r = parseRef(text);
    if (!r) { new Notice('장절을 알아보지 못했습니다.'); return; }
    const view = await this.activateView();
    if (view && view.search) view.search(text);
  }

  followBibleFinder() {
    if (!this.settings.autoFollow) return;
    const view = this.getView();
    if (!view) return;
    let q = '';
    try {
      // 마지막으로 사용한 성경 찾기 화면을 우선
      const types = ['bible-compare-view', 'strong-bible-view'];
      const bf = this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins['obsidian-bible-finder'];
      if (bf && bf._lastFocusedBibleViewType === 'strong-bible-view') types.reverse();
      for (const t of types) {
        for (const leaf of this.app.workspace.getLeavesOfType(t)) {
          const v = leaf.view;
          const cur = v && (v.currentQuery || v.currentSearch);
          if (cur) { q = String(cur).trim(); break; }
        }
        if (q) break;
      }
    } catch (e) { return; }
    if (!q || q === this._lastFollow) return;

    // 이미 같은 성경 장절이 표시되어 있다면 화면을 다시 렌더링하지 않고 _lastFollow만 갱신!
    const r = parseRef(q);
    if (r && view.current &&
        view.current.b === r.b &&
        view.current.ch === r.ch &&
        view.current.v1 === r.v1 &&
        view.current.v2 === r.v2 &&
        view.resultsEl && view.resultsEl.querySelector('.scf-split-container')) {
      this._lastFollow = q;
      return;
    }

    this._lastFollow = q;
    view.search(q, true);
  }

  resolvePath(sourceId, rel) {
    const nodePath = require('path');
    const fs = require('fs');
    const idx = this.index;
    let root = (this.settings && this.settings.rootOverrides && this.settings.rootOverrides[sourceId]) ||
               (idx && idx.sources && idx.sources[sourceId] && idx.sources[sourceId].root);
    
    // 기본 실존 경로 자동 복구 ('?' 포함 또는 미존재 시 안전 경로 적용)
    if (!root || root.includes('?') || !fs.existsSync(root)) {
      if (sourceId === 'grand') {
        root = 'c:\\Users\\D-kanghyodgeun\\Documents\\0.종합도서관\\03.성경 주석, 강해\\그랜드 종합주석(OCR)';
      } else if (sourceId === 'oxford') {
        root = 'c:\\Users\\D-kanghyodgeun\\Documents\\0.종합도서관\\03.성경 주석, 강해\\옥스퍼드원어대전OCR';
      }
    }
    return nodePath.join(root, ...rel.split('/'));
  }

  async openPdf(sourceId, rel, page) {
    // 모바일 / 아이패드 환경 대응: Node API 호출 방지 및 친절한 안내
    const isMobile = (typeof Platform !== 'undefined' && Platform && Platform.isMobile) ||
                     (this.app && this.app.isMobile) ||
                     (typeof require !== 'function');

    if (isMobile) {
      new Notice('📱 원본 PDF 파일은 PC 로컬 드라이브에 보관되어 있습니다.\n아이패드에서는 고품질 AI 교정 텍스트를 바로 열람하실 수 있습니다.', 7000);
      return;
    }

    const fs = require('fs');
    const nodePath = require('path');
    const { shell } = require('electron');
    const { spawn } = require('child_process');

    let abs = null;
    try {
      abs = this.resolvePath(sourceId, rel);
    } catch (_) {}

    // 여러 실존 후보 경로 검사 (Documents 및 OneDrive 성경주석 폴더 모두 지원)
    const baseFname = nodePath.basename(rel);
    const compactFname = baseFname.replace(/[\s\(\)]/g, '');
    const candidates = [
      abs,
      nodePath.join('c:\\Users\\D-kanghyodgeun\\Documents\\0.종합도서관\\03.성경 주석, 강해\\그랜드 종합주석(OCR)', ...rel.split('/')),
      nodePath.join('c:\\Users\\D-kanghyodgeun\\Documents\\0.종합도서관\\03.성경 주석, 강해\\옥스퍼드원어대전OCR', ...rel.split('/')),
      nodePath.join('c:\\Users\\D-kanghyodgeun\\OneDrive\\● 성경주석\\00.원어대전\\00.원어대전', baseFname),
      nodePath.join('c:\\Users\\D-kanghyodgeun\\OneDrive\\● 성경주석\\00.원어대전\\00.원어대전', compactFname),
      nodePath.join('c:\\Users\\D-kanghyodgeun\\OneDrive\\● 성경주석\\01.그랜드주석', baseFname),
      nodePath.join('c:\\Users\\D-kanghyodgeun\\OneDrive\\● 성경주석\\01.그랜드주석', compactFname),
      nodePath.join('c:\\Users\\D-kanghyodgeun\\Documents\\0.종합도서관\\01.그랜드주석', baseFname)
    ].filter(Boolean);

    let foundPath = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      new Notice(`PDF 파일을 찾을 수 없습니다:\n${abs || rel}\n(PC 주석 폴더 위치를 확인하세요)`, 8000);
      return;
    }

    const s = this.settings || {};
    const fname = nodePath.basename(foundPath);
    const cleanSlash = foundPath.replace(/\\/g, '/');
    const fileUrl = 'file:///' + encodeURI(cleanSlash).replace(/#/g, '%23') + `#page=${page}`;

    // 1) Edge 실행 (#page=NN 해당 쪽수로 즉시 열기)
    const edgeExe = s.edgePath || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    if ((s.viewer === 'edge' || s.viewer === 'system' || !s.viewer) && fs.existsSync(edgeExe)) {
      try {
        const child = spawn(edgeExe, [fileUrl], { detached: true, stdio: 'ignore' });
        child.unref();
        new Notice(`📄 Edge로 PDF 열림: ${fname} (${page}쪽)`);
        return;
      } catch (e) {
        console.warn('[Edge 실행 실패 -> fallback]', e);
      }
    }

    // 2) Acrobat 실행 (사용자가 명시적으로 acrobat을 지정한 경우)
    const acrobatExe = s.acrobatPath || 'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe';
    if (s.viewer === 'acrobat' && fs.existsSync(acrobatExe)) {
      try {
        const child = spawn(acrobatExe, ['/A', `page=${page}`, foundPath], { detached: true, stdio: 'ignore' });
        child.unref();
        new Notice(`📄 Acrobat으로 PDF 열림: ${fname} (${page}쪽)`);
        return;
      } catch (e) {
        console.warn('[Acrobat 실행 실패 -> fallback]', e);
      }
    }

    // 3) Chrome 실행
    const chromeExe = s.chromePath || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (fs.existsSync(chromeExe)) {
      try {
        const child = spawn(chromeExe, [fileUrl], { detached: true, stdio: 'ignore' });
        child.unref();
        new Notice(`📄 Chrome으로 PDF 열림: ${fname} (${page}쪽)`);
        return;
      } catch (e) {
        console.warn('[Chrome 실행 실패 -> fallback]', e);
      }
    }

    // 4) shell.openExternal (기본 브라우저 URL로 열기)
    try {
      await shell.openExternal(fileUrl);
      new Notice(`📄 PDF 열림: ${fname} (${page}쪽)`);
      return;
    } catch (e) {
      console.warn('[shell.openExternal 실패 -> openPath]', e);
    }

    // 5) shell.openPath (시스템 기본 PDF 뷰어로 직접 파일 열기)
    try {
      const err = await shell.openPath(foundPath);
      if (!err) {
        new Notice(`📄 PDF 열림: ${fname}`);
        return;
      }
      throw new Error(err);
    } catch (err) {
      new Notice(`PDF 열기 실패: ${err.message}`, 8000);
    }
  }
  async loadBibleDictionary() {
    if (this._bibleDict) return this._bibleDict;
    const packRelPath = `${this.manifest.dir}/data/packs/bible-dict/bible-dict.json`;
    const relPath = `${this.manifest.dir}/data/bible-dict.json`;
    // 0. Desktop 선택 다운로드 팩(보관함 외부) 확인
    if (!(Platform && Platform.isMobile) && typeof require === 'function') {
      try {
        const rootDir = this._getPackStorageRoot();
        if (rootDir) {
          const fs = require('fs');
          const path = require('path');
          const packDictPath = path.join(rootDir, 'packs', 'bible-dict', 'bible-dict.json');
          if (fs.existsSync(packDictPath)) {
            this._bibleDict = JSON.parse(fs.readFileSync(packDictPath, 'utf8'));
            return this._bibleDict;
          }
        }
      } catch (err) {
        console.warn('[loadBibleDictionary pack fs 실패]', err);
      }
    }
    // 1. 보관함 내 선택 다운로드 팩(모바일) 또는 기존 로컬 bible-dict.json 확인
    try {
      for (const candidateRel of [packRelPath, relPath]) {
        if (await this.app.vault.adapter.exists(candidateRel)) {
          const raw = await this.app.vault.adapter.read(candidateRel);
          this._bibleDict = JSON.parse(raw);
          return this._bibleDict;
        }
      }
    } catch (err) {
      console.warn('[loadBibleDictionary adapter 실패, fallback 시도]', err);
    }
    // Fallback for Node.js environment (Desktop external/local folder)
    try {
      const fs = require('fs');
      const path = require('path');
      const extDict = this._getExternalFilePath('bible-dict.json');
      if (extDict) {
        const raw = fs.readFileSync(extDict, 'utf8');
        this._bibleDict = JSON.parse(raw);
        return this._bibleDict;
      }
      const basePath = this.app.vault.adapter.basePath || (this.app.vault.adapter.getBasePath ? this.app.vault.adapter.getBasePath() : '');
      if (basePath) {
        const dictPath = path.join(basePath, '.obsidian', 'plugins', 'sermon-commentary-finder', 'data', 'bible-dict.json');
        if (fs.existsSync(dictPath)) {
          const raw = fs.readFileSync(dictPath, 'utf8');
          this._bibleDict = JSON.parse(raw);
          return this._bibleDict;
        }
      }
    } catch (e) {}
    if (this.settings && this.settings.installedPacksOnly) {
      return { total: 0, entries: [] };
    }
    // BRAT / 모바일 환경: 원격 데이터 저장소에서 성경사전 온디맨드 다운로드
    try {
      new Notice('성경대사전(약 10MB)을 내려받는 중입니다...');
      const { data, rawText } = await this.fetchRawJson('dictionaries/bible-dict.json', 45000);
      if (data) {
        await this.ensureVaultDir(`${this.manifest.dir}/data`);
        await this.app.vault.adapter.write(relPath, rawText || JSON.stringify(data));
        this._bibleDict = data;
        new Notice('성경대사전 준비 완료!');
        return this._bibleDict;
      }
    } catch (e) {
      console.warn('[loadBibleDictionary 원격 다운로드 실패]', e);
    }
    return { total: 0, entries: [] };
  }

  async activateDictionaryView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICT)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_DICT, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

};
