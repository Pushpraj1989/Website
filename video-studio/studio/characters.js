/* Omani lady: shayla over the hair and around the face, black abaya with embroidered trim */
function lady(id){
  return `<svg viewBox="0 0 520 546" width="520" height="546"><defs>
    <linearGradient id="${id}-ab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26232d"/><stop offset="1" stop-color="#121116"/></linearGradient>
    <radialGradient id="${id}-sk" cx=".45" cy=".38" r=".75"><stop offset="0" stop-color="#f2c9a6"/><stop offset=".7" stop-color="#e2ad86"/><stop offset="1" stop-color="#cf9771"/></radialGradient>
    <linearGradient id="${id}-sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3d55"/><stop offset=".55" stop-color="#2c2535"/><stop offset="1" stop-color="#19151f"/></linearGradient>
    <radialGradient id="${id}-ir" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#9a6a3c"/><stop offset="1" stop-color="#4a2c16"/></radialGradient>
    <pattern id="${id}-emb" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#1b1a20"/><path d="M11 2 L18 11 L11 20 L4 11Z" fill="none" stroke="#d4ad5a" stroke-width="2"/><circle cx="11" cy="11" r="2.4" fill="#2bb3a3"/></pattern>
  </defs>
  <!-- abaya -->
  <path d="M70 546 C76 430 140 372 260 368 C380 372 444 430 450 546Z" fill="url(#${id}-ab)"/>
  <path d="M240 420 L280 420 L274 546 L246 546Z" fill="url(#${id}-emb)"/><path d="M236 420 L284 420" stroke="#d4ad5a" stroke-width="3"/>
  <path d="M150 420 C170 470 176 510 172 546" stroke="#000" stroke-opacity=".25" stroke-width="4" fill="none"/><path d="M370 420 C350 470 344 510 348 546" stroke="#000" stroke-opacity=".25" stroke-width="4" fill="none"/>
  <!-- shayla: back drape and the wrap round the face -->
  <path d="M152 236 C140 120 210 92 262 92 C318 92 382 122 370 238 C366 300 352 350 330 392 C300 420 222 420 190 392 C168 352 156 300 152 236Z" fill="url(#${id}-sh)"/>
  <path d="M190 392 C230 424 296 424 330 392 C340 404 344 416 342 428 C300 446 220 446 178 428 C176 416 180 404 190 392Z" fill="#1f1b25"/>
  <!-- face -->
  <path d="M200 222 C200 160 230 140 262 140 C294 140 322 160 322 222 C322 292 296 330 262 332 C228 330 200 292 200 222Z" fill="url(#${id}-sk)"/>
  <path d="M196 214 C196 150 232 128 262 128 C292 128 328 150 328 214 C316 176 296 158 262 156 C228 158 208 176 196 214Z" fill="url(#${id}-sh)"/>
  <path d="M180 200 C186 130 230 106 262 104" stroke="#fff" stroke-opacity=".10" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M212 168 C232 150 292 150 312 168" stroke="#5c4d68" stroke-width="3" fill="none" opacity=".7"/>
  <!-- brows -->
  <g fill="#3b2418"><path id="${id}-bl" d="M214 196 C226 186 244 186 252 192 L250 198 C240 194 228 195 216 202Z"/><path id="${id}-br" d="M308 196 C296 186 278 186 270 192 L272 198 C282 194 294 195 306 202Z"/></g>
  <!-- eyes -->
  <g id="${id}-eyes">
    <ellipse cx="235" cy="222" rx="17" ry="15" fill="#fff"/><ellipse cx="289" cy="222" rx="17" ry="15" fill="#fff"/>
    <circle cx="237" cy="224" r="12" fill="url(#${id}-ir)"/><circle cx="291" cy="224" r="12" fill="url(#${id}-ir)"/>
    <circle cx="237" cy="225" r="6.5" fill="#160c07"/><circle cx="291" cy="225" r="6.5" fill="#160c07"/>
    <circle cx="242" cy="219" r="4" fill="#fff"/><circle cx="296" cy="219" r="4" fill="#fff"/><circle cx="233" cy="229" r="1.8" fill="#fff" opacity=".8"/><circle cx="287" cy="229" r="1.8" fill="#fff" opacity=".8"/>
    <path d="M217 219 C225 204 247 203 254 213" stroke="#160c07" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M307 219 C299 204 277 203 270 213" stroke="#160c07" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M218 217 L210 210 M222 211 L216 203" stroke="#160c07" stroke-width="3" stroke-linecap="round"/><path d="M306 217 L314 210 M302 211 L308 203" stroke="#160c07" stroke-width="3" stroke-linecap="round"/>
  </g>
  <path d="M260 238 C257 252 256 258 262 262 C266 262 268 260 268 258" stroke="#b97c5a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="222" cy="258" rx="16" ry="9" fill="#ff7f8a" opacity=".32"/><ellipse cx="302" cy="258" rx="16" ry="9" fill="#ff7f8a" opacity=".32"/>
  <!-- mouths -->
  <g id="${id}-m-neutral"><path d="M247 283 C255 288 269 288 277 283 C269 296 255 296 247 283Z" fill="#d0607a"/><path d="M256 289 C260 290 264 290 268 289" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/></g>
  <g id="${id}-m-smile" opacity="0"><path d="M244 280 C254 300 270 300 280 280 Z" fill="#9e3a4f"/><path d="M247 281 L277 281 L274 287 L250 287Z" fill="#fff"/></g>
  <path id="${id}-m-worry" d="M248 292 C256 284 268 284 276 292" stroke="#b44a5e" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>
  <ellipse id="${id}-m-shock" cx="262" cy="290" rx="10" ry="13" fill="#8e3346" opacity="0"/>
  <!-- hands from embroidered sleeves -->
  <g id="${id}-hands">
    <g id="${id}-hl"><rect x="140" y="488" width="84" height="30" rx="12" fill="url(#${id}-emb)"/><ellipse cx="182" cy="526" rx="32" ry="20" fill="url(#${id}-sk)"/></g>
    <g id="${id}-hr"><rect x="296" y="488" width="84" height="30" rx="12" fill="url(#${id}-emb)"/><ellipse cx="338" cy="526" rx="32" ry="20" fill="url(#${id}-sk)"/></g>
  </g></svg>`;
}
/* Omani man: white dishdasha with furakha tassel and an embroidered kumma */
function man(id){
  return `<svg viewBox="0 0 520 546" width="520" height="546"><defs>
    <linearGradient id="${id}-ds" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dcd8ce"/></linearGradient>
    <radialGradient id="${id}-sk" cx=".45" cy=".38" r=".75"><stop offset="0" stop-color="#d9a77f"/><stop offset=".7" stop-color="#c48d65"/><stop offset="1" stop-color="#ad7752"/></radialGradient>
    <pattern id="${id}-km" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#f7f4ec"/><circle cx="9" cy="9" r="3" fill="#2b6cb0"/><path d="M0 9h4M14 9h4M9 0v4M9 14v4" stroke="#c0392b" stroke-width="2"/></pattern>
  </defs>
  <path d="M80 546 C86 420 150 344 260 340 C370 344 434 420 440 546Z" fill="url(#${id}-ds)"/>
  <path d="M240 344 C246 368 274 368 280 344" stroke="#cfcab9" stroke-width="4" fill="none"/>
  <path d="M260 366 L260 450" stroke="#d9c79b" stroke-width="4"/><path d="M252 450 L268 450 L264 482 L256 482Z" fill="#d9c79b"/>
  <rect x="236" y="296" width="48" height="56" rx="18" fill="url(#${id}-sk)"/>
  <ellipse cx="190" cy="234" rx="14" ry="20" fill="url(#${id}-sk)"/><ellipse cx="330" cy="234" rx="14" ry="20" fill="url(#${id}-sk)"/>
  <ellipse cx="260" cy="228" rx="70" ry="82" fill="url(#${id}-sk)"/>
  <path d="M196 252 C200 300 228 318 260 320 C292 318 320 300 324 252 C316 286 292 296 260 296 C228 296 204 286 196 252Z" fill="#231a15"/>
  <path d="M236 280 C248 272 272 272 284 280 C272 284 248 284 236 280Z" fill="#231a15"/>
  <path d="M188 190 C188 120 230 104 260 104 C290 104 332 120 332 190 C300 176 220 176 188 190Z" fill="url(#${id}-km)"/>
  <path d="M188 190 C220 176 300 176 332 190" stroke="#2b6cb0" stroke-width="5" fill="none"/>
  <g fill="#231a15"><path id="${id}-bl" d="M214 200 C226 192 244 192 252 197 L250 204 C240 200 228 201 216 207Z"/><path id="${id}-br" d="M306 200 C294 192 276 192 268 197 L270 204 C280 200 292 201 304 207Z"/></g>
  <g id="${id}-eyes" style="transform-origin:260px 226px">
    <ellipse cx="234" cy="226" rx="12" ry="10" fill="#fff"/><ellipse cx="286" cy="226" rx="12" ry="10" fill="#fff"/>
    <circle cx="235" cy="227" r="7.5" fill="#3b2414"/><circle cx="287" cy="227" r="7.5" fill="#3b2414"/><circle cx="238" cy="224" r="2.6" fill="#fff"/><circle cx="290" cy="224" r="2.6" fill="#fff"/>
    <path d="M222 222 C230 214 242 214 248 220" stroke="#1a0f0a" stroke-width="3" fill="none"/><path d="M298 222 C290 214 278 214 272 220" stroke="#1a0f0a" stroke-width="3" fill="none"/>
  </g>
  <path d="M258 240 C255 254 254 260 260 264 C264 264 266 262 266 260" stroke="#9c6744" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path id="${id}-m-neutral" d="M246 288 Q260 294 274 288" stroke="#6b2f2a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path id="${id}-m-smile" d="M242 284 Q260 304 278 284" stroke="#6b2f2a" stroke-width="5" fill="#fff" opacity="0"/>
  <path id="${id}-m-worry" d="M246 294 Q260 282 274 294" stroke="#6b2f2a" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>
  <ellipse id="${id}-m-shock" cx="260" cy="292" rx="10" ry="12" fill="#5a2622" opacity="0"/>
  <g id="${id}-hands"><ellipse id="${id}-hl" cx="185" cy="522" rx="32" ry="20" fill="url(#${id}-sk)"/><ellipse id="${id}-hr" cx="335" cy="522" rx="32" ry="20" fill="url(#${id}-sk)"/></g>
  </svg>`;
}

