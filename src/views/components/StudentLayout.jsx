import { Link } from "react-router-dom";
export default function StudentLayout({ children }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between">
        <span className="font-bold">Modo Alumno</span>
        <Link to="/student-hub" className="text-sm underline">Hub</Link>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full p-4">{children}</main>
    </div>
  );
}