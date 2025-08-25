import React, { useState } from 'react'
import { Grid3X3, RotateCcw, Brain, User, Trophy, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

interface GameState {
  board: string[][]
  winner: string
  gameOver: boolean
  message: string
  currentPlayer?: string
}

interface AIMove {
  row: number
  col: number
  board: string[][]
  winner: string
  gameOver: boolean
  message: string
}

interface ApiResponse {
  success: boolean
  data: GameState | AIMove
  message: string
  gameId?: string
}

export default function TicTacToe() {
  const [gameState, setGameState] = useState<GameState>({
    board: [[' ', ' ', ' '], [' ', ' ', ' '], [' ', ' ', ' ']],
    winner: ' ',
    gameOver: false,
    message: 'Click "New Game" to start playing!',
    currentPlayer: 'X'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [javaGameId, setJavaGameId] = useState<string | null>(null)
  const [useJavaBackend, setUseJavaBackend] = useState(true)
  const [gameStats, setGameStats] = useState({
    wins: 0,
    losses: 0,
    ties: 0
  })

  const startNewGameJava = async (): Promise<GameState | null> => {
    try {
      const response = await fetch('http://localhost:8080/api/tictactoe/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data: ApiResponse = await response.json()
        if (data.success && data.data && data.gameId) {
          setJavaGameId(data.gameId)
          return data.data as GameState
        }
      }
    } catch (error) {
      console.log('Java backend not available, falling back to Edge Function')
      setUseJavaBackend(false)
    }
    return null
  }

  const startNewGameEdgeFunction = async (): Promise<GameState> => {
    const { data, error } = await supabase.functions.invoke('tictactoe-game', {
      body: { action: 'start' }
    })

    if (error) {
      throw new Error('Failed to start game with Edge Function')
    }

    if (data?.success && data?.data) {
      return data.data as GameState
    }
    
    throw new Error('Invalid response from Edge Function')
  }

  const makeMoveJava = async (row: number, col: number): Promise<GameState | null> => {
    if (!javaGameId) return null
    
    try {
      const response = await fetch('http://localhost:8080/api/tictactoe/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: javaGameId, row, col })
      })
      
      if (response.ok) {
        const data: ApiResponse = await response.json()
        if (data.success && data.data) {
          return data.data as GameState
        }
      }
    } catch (error) {
      console.log('Java backend move failed, falling back to Edge Function')
      setUseJavaBackend(false)
    }
    return null
  }

  const makeMoveEdgeFunction = async (row: number, col: number): Promise<GameState> => {
    const { data, error } = await supabase.functions.invoke('tictactoe-game', {
      body: { action: 'move', board: gameState.board, row, col }
    })

    if (error) {
      throw new Error('Failed to make move with Edge Function')
    }

    if (data?.success && data?.data) {
      return data.data as GameState
    }
    
    throw new Error('Invalid response from Edge Function')
  }

  const getAIMoveJava = async (): Promise<AIMove | null> => {
    if (!javaGameId) return null
    
    try {
      const response = await fetch('http://localhost:8080/api/tictactoe/ai-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: javaGameId })
      })
      
      if (response.ok) {
        const data: ApiResponse = await response.json()
        if (data.success && data.data) {
          return data.data as AIMove
        }
      }
    } catch (error) {
      console.log('Java backend AI move failed, falling back to Edge Function')
      setUseJavaBackend(false)
    }
    return null
  }

  const getAIMoveEdgeFunction = async (): Promise<AIMove> => {
    const { data, error } = await supabase.functions.invoke('tictactoe-game', {
      body: { action: 'ai-move', board: gameState.board }
    })

    if (error) {
      throw new Error('Failed to get AI move with Edge Function')
    }

    if (data?.success && data?.data) {
      return data.data as AIMove
    }
    
    throw new Error('Invalid response from Edge Function')
  }

  const startNewGame = async () => {
    setIsLoading(true)
    try {
      let newGameState = null
      
      if (useJavaBackend) {
        newGameState = await startNewGameJava()
      }
      
      if (!newGameState) {
        newGameState = await startNewGameEdgeFunction()
      }
      
      setGameState({
        ...newGameState,
        message: 'Your turn! You are X, AI is O.'
      })
      toast.success('New game started! Make your move!')
    } catch (error) {
      console.error('Error starting game:', error)
      toast.error('Failed to start new game. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const makeMove = async (row: number, col: number) => {
    if (gameState.gameOver || gameState.board[row][col] !== ' ' || isThinking) {
      return
    }

    setIsLoading(true)
    
    try {
      // Make human move
      let moveResult = null
      
      if (useJavaBackend) {
        moveResult = await makeMoveJava(row, col)
      }
      
      if (!moveResult) {
        moveResult = await makeMoveEdgeFunction(row, col)
      }
      
      if (moveResult.message === 'Invalid move') {
        toast.error('Invalid move! Try another cell.')
        return
      }
      
      setGameState(moveResult)
      
      // Check if game is over after human move
      if (moveResult.gameOver) {
        updateGameStats(moveResult.winner)
        toast.success(moveResult.message)
        return
      }
      
      // Get AI move
      setIsThinking(true)
      setTimeout(async () => {
        try {
          let aiMove = null
          
          if (useJavaBackend) {
            aiMove = await getAIMoveJava()
          }
          
          if (!aiMove) {
            aiMove = await getAIMoveEdgeFunction()
          }
          
          const aiGameState: GameState = {
            board: aiMove.board,
            winner: aiMove.winner,
            gameOver: aiMove.gameOver,
            message: aiMove.message,
            currentPlayer: 'X'
          }
          
          setGameState(aiGameState)
          
          if (aiGameState.gameOver) {
            updateGameStats(aiGameState.winner)
            toast.success(aiGameState.message)
          } else {
            toast.success(`AI played row ${aiMove.row + 1}, col ${aiMove.col + 1}. Your turn!`)
          }
        } catch (error) {
          console.error('Error getting AI move:', error)
          toast.error('AI move failed. Please start a new game.')
        } finally {
          setIsThinking(false)
        }
      }, 500) // Small delay to show AI "thinking"
      
    } catch (error) {
      console.error('Error making move:', error)
      toast.error('Failed to make move. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const updateGameStats = (winner: string) => {
    setGameStats(prev => ({
      wins: winner === 'X' ? prev.wins + 1 : prev.wins,
      losses: winner === 'O' ? prev.losses + 1 : prev.losses,
      ties: winner === ' ' ? prev.ties + 1 : prev.ties
    }))
  }

  const getCellContent = (cell: string) => {
    if (cell === 'X') {
      return <span className="text-blue-600 font-bold text-3xl">✕</span>
    } else if (cell === 'O') {
      return <span className="text-red-600 font-bold text-3xl">⭕</span>
    }
    return null
  }

  const getCellClass = (row: number, col: number) => {
    const isWinningCell = gameState.gameOver && gameState.winner !== ' '
    const baseClass = "w-20 h-20 border-2 border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
    
    if (gameState.board[row][col] !== ' ' || gameState.gameOver || isThinking) {
      return baseClass + " cursor-not-allowed"
    }
    
    return baseClass + " hover:bg-blue-50"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full mr-3">
              <Grid3X3 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Tic-Tac-Toe</h1>
          </div>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Challenge our AI powered by the Minimax algorithm. Test your strategy against unbeatable logic!
          </p>
          <div className="flex items-center justify-center mt-4">
            <div className="bg-green-50 px-4 py-2 rounded-full border border-green-200">
              <div className="flex items-center text-sm text-green-600">
                <Brain className="h-4 w-4 mr-2" />
                <span className="font-medium">
                  {useJavaBackend ? 'Java Backend + Edge Function Fallback' : 'Edge Function Mode'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 text-center border border-slate-200">
            <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900">{gameStats.wins}</div>
            <div className="text-sm text-slate-600">Wins</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-slate-200">
            <Brain className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900">{gameStats.losses}</div>
            <div className="text-sm text-slate-600">Losses</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-slate-200">
            <Zap className="h-6 w-6 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900">{gameStats.ties}</div>
            <div className="text-sm text-slate-600">Ties</div>
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-6">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center mr-6">
                <User className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-lg font-semibold text-slate-900">You (X)</span>
              </div>
              <div className="text-slate-400 text-xl font-bold">VS</div>
              <div className="flex items-center ml-6">
                <Brain className={`h-5 w-5 text-red-600 mr-2 ${isThinking ? 'animate-pulse' : ''}`} />
                <span className="text-lg font-semibold text-slate-900">
                  AI (O) {isThinking ? '- Thinking...' : ''}
                </span>
              </div>
            </div>
            
            <div className="text-lg font-medium text-slate-700 mb-4">
              {gameState.message}
            </div>
          </div>
          
          {/* Board Grid */}
          <div className="flex justify-center mb-6">
            <div className="grid grid-cols-3 gap-2 bg-slate-200 p-4 rounded-lg">
              {gameState.board.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={getCellClass(rowIndex, colIndex)}
                    onClick={() => makeMove(rowIndex, colIndex)}
                  >
                    {getCellContent(cell)}
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Loading/Thinking Indicator */}
          {(isLoading || isThinking) && (
            <div className="text-center mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-slate-600">
                {isThinking ? 'AI is calculating the best move...' : 'Processing move...'}
              </p>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="text-center">
          <button
            onClick={startNewGame}
            disabled={isLoading || isThinking}
            className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg inline-flex items-center mr-4"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            New Game
          </button>
        </div>

        {/* Feature Info */}
        <div className="mt-12 bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-6 border border-green-200">
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900 mb-3">AI Strategy</h3>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="flex items-start">
                <div className="bg-blue-100 w-8 h-8 rounded-lg flex items-center justify-center mr-3 mt-1">
                  <Brain className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Minimax Algorithm</h4>
                  <p className="text-slate-600 text-sm">The AI uses the minimax algorithm to evaluate all possible game states and choose the optimal move.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-green-100 w-8 h-8 rounded-lg flex items-center justify-center mr-3 mt-1">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Unbeatable Logic</h4>
                  <p className="text-slate-600 text-sm">The AI will never lose - it can only win or tie, making every game a challenge!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}