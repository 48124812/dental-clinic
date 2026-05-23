export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 grid gap-6 sm:grid-cols-3">
        <div>
          <div className="text-white font-semibold mb-2">光明牙醫診所</div>
          <p>專業、溫暖、值得信賴的鄰里牙醫。</p>
        </div>
        <div>
          <div className="text-white font-semibold mb-2">聯絡資訊</div>
          <p>📞 (02) 2345-6789</p>
          <p>📍 台北市信義區光復南路 100 號</p>
        </div>
        <div>
          <div className="text-white font-semibold mb-2">注意事項</div>
          <p className="text-xs">本站醫療資訊僅供參考，實際療程依醫師評估為準。</p>
        </div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} 光明牙醫診所 — Built with Next.js
      </div>
    </footer>
  );
}
