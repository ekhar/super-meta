import { ChessBoard } from './components/ChessBoard'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Chess Opening Explorer</h1>
      </header>
      <main className="app-main">
        <ChessBoard />
      </main>
    </div>
  )
}

export default App 