// --- 元件說明資料 ---
// 請在此處編輯您的元件說明。
// 每一行就是一個元件 "類別" 的說明。
// 格式: "類別名稱,說明文字"
// - 說明文字內部可以使用分號 (;) 來換行。
// - 範例圖片網址可以直接加在說明文字後面。
const componentDetailsData = [
  // --- 無熔絲開關 (NFB) ---
  "nfb,無熔絲開關 (No-Fuse Breaker)，簡稱NFB，是一種同時具備過載、短路保護及手動開關功能的低壓電路保護裝置。",

  // --- 指示燈 (Bulb) ---
  "bulb,指示燈，用於顯示電路的狀態，例如運轉、停止或故障。",

  // --- 開關元件 (Switch) ---
  "pushbutton_no,按鈕 (常開 NO - Normally Open)，平時為斷路狀態，按下時才會導通。",
  "pushbutton_nc,按鈕 (常閉 NC - Normally Closed)，平時為通路狀態，按下時才會斷路。",
  "rotary_2pos,二段選擇開關 (2-Position Rotary Switch)，可在兩個位置之間切換，常用於手動/自動模式切換。",
  "rotary_3pos,三段選擇開關 (3-Position Rotary Switch)，可在三個位置之間切換，提供更多控制選項。",

  // --- 電磁接觸器 (Contactor) ---
  "contactor,電磁接觸器 (Magnetic Contactor)，利用線圈電磁力來控制主接點開閉的自動開關，常用於控制馬達等高功率負載。",

  // --- 繼電器 (Relay) ---
  "2C,2C電力電驛，提供兩組可切換的接點。https://weibsite.github.io/Industrial-Wiring/image/2c.jpg",
  "3C,3C電力電驛，提供三組可切換的接點。https://weibsite.github.io/Industrial-Wiring/image/3c.jpg",
  "4C,4C電力電驛，提供四組可切換的接點。https://weibsite.github.io/Industrial-Wiring/image/4c.jpg",
  "ON-delay,ON-delay (通電延遲) 限時電驛，線圈通電後，經過設定時間，接點才會動作。https://weibsite.github.io/Industrial-Wiring/image/ondelay.jpg",
  "Y-delta-27,Y-Δ 限時27電驛，專為Y-Δ啟動設計的計時器，提供特定的接點組合。https://weibsite.github.io/Industrial-Wiring/image/27.jpg",
  "Y-delta-28,Y-Δ 限時28電驛，另一種專為Y-Δ啟動設計的計時器。https://weibsite.github.io/Industrial-Wiring/image/28.jpg",

  // --- 積熱電驛 (TH-RY) ---
  "th-ry_A,標準型積熱電驛 (Thermal Overload Relay)，用於保護馬達免於過載，此型號具有獨立的NO(97-98)與NC(95-96)接點。",
  "th-ry_B,共點型積熱電驛 (Thermal Overload Relay)，此型號的NO與NC接點共用一個COM點(95)。",

  // --- 馬達 (Motor) ---
  "motor_3-phase-6,三相六接點馬達，標準的三相感應馬達，有六個接線點，可用於Y-Δ啟動。",
  "motor_1-phase-3,單相三線式馬達，常用於家用或小型商業設備。",
  "motor_1-phase-2,單相二線式馬達，最基本的單相馬達類型。",

  // --- 保險絲座 (Fuse) ---
  "fuse,保險絲座，用於安裝保險絲，提供電路短路保護。",

  // --- 端子台 (Terminal Block) ---
  "terminalBlock,端子台 (Terminal Block, TB)，用於方便地連接多條電線，使配線整齊且易於維護。"
];

