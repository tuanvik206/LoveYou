import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-rose-100/50 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔍</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          Trang không tồn tại
        </h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Trang bạn tìm không tồn tại. Quay về trang chủ nhé!
        </p>
        <Link
          href="/"
          className="block w-full py-3 bg-rose-500 text-white rounded-2xl font-bold text-sm text-center active:scale-95 transition-transform shadow-sm shadow-rose-200"
        >
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
