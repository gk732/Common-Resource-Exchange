import React, { useState } from 'react'
import { Grid3X3, RotateCcw, Brain, User, X, Minimize2, Maximize2, Trophy, AlertCircle, CheckCircle } from 'lucide-react'
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

export default function TicTacToeWidget() {
  const [isMinimized, setIsMinimized] = useState(true) // Start as small icon
  const [gameState, setGameState] = useState<GameState>({
    board: [[' ', ' ', ' '], [' ', ' ', ' '], [' ', ' ', ' ']],
    winner: ' ',
    gameOver: false,
    message: 'Click "New Game" to start!',
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
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null)

  const toggleWidget = () => {
    setIsMinimized(!isMinimized)
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

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
      // showNotification('New game started!', 'success') - REMOVED POPUP
    } catch (error) {
      console.error('Error starting game:', error)
      // showNotification('Failed to start new game.', 'error') - REMOVED POPUP
    } finally {
      setIsLoading(false)
    }
  }

  const makeMove = async (row: number, col: number) => {
    if (gameState.gameOver || gameState.board[row][col] !== ' ' || isThinking || isLoading) {
      return
    }

    // CRITICAL FIX: Immediately update board with player move and lock it
    const newBoard = gameState.board.map((boardRow, rowIdx) => 
      boardRow.map((cell, colIdx) => 
        (rowIdx === row && colIdx === col) ? 'X' : cell
      )
    )
    
    // Update game state immediately - this should NEVER be overwritten
    const updatedGameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: 'O' as string,
      message: 'Your move made! AI is thinking...'
    }
    
    setGameState(updatedGameState)
    setIsLoading(true)
    
    try {
      // Backend validation (but don't overwrite board state)
      let moveResult = null
      
      if (useJavaBackend) {
        moveResult = await makeMoveJava(row, col)
      }
      
      if (!moveResult) {
        moveResult = await makeMoveEdgeFunction(row, col)
      }
      
      if (moveResult?.message === 'Invalid move') {
        // Only revert if backend says move was invalid
        setGameState(gameState)
        // showNotification('Invalid move!', 'error') - REMOVED POPUP
        setIsLoading(false)
        return
      }
      
      // CRITICAL: Check for win condition after player move using our board
      const playerWin = checkWinCondition(newBoard, 'X')
      const isDraw = newBoard.every(row => row.every(cell => cell !== ' '))
      
      if (playerWin) {
        setGameState({
          ...updatedGameState,
          winner: 'X',
          gameOver: true,
          message: 'Congratulations! You won!'
        })
        updateGameStats('X')
        // showNotification('You won!', 'success') - REMOVED POPUP
        setIsLoading(false)
        return
      }
      
      if (isDraw) {
        setGameState({
          ...updatedGameState,
          winner: ' ',
          gameOver: true,
          message: "It's a tie!"
        })
        updateGameStats(' ')
        // showNotification("It's a tie!", 'success') - REMOVED POPUP
        setIsLoading(false)
        return
      }
      
      // Game continues - get AI move
      setIsThinking(true)
      setGameState({
        ...updatedGameState,
        message: 'Your turn!'
      })
      
      setTimeout(async () => {
        try {
          let aiMove = null
          
          if (useJavaBackend) {
            aiMove = await getAIMoveJava()
          }
          
          if (!aiMove) {
            // Use our local board for Edge Function call
            aiMove = await getAIMoveEdgeFunction()
          }
          
          // CRITICAL FALLBACK: If AI calculation failed, find any available square
          if (!aiMove || aiMove.row < 0 || aiMove.row > 2 || aiMove.col < 0 || aiMove.col > 2) {
            console.warn('AI calculation failed, using fallback logic')
            aiMove = findAvailableSquare(newBoard)
          }

          // CRITICAL FALLBACK: If AI tried to overwrite, find alternative square
          if (aiMove && newBoard[aiMove.row][aiMove.col] !== ' ') {
            console.warn('AI attempted invalid move, finding alternative')
            aiMove = findAvailableSquare(newBoard)
          }

          // FINAL CHECK: Ensure we have a valid move
          if (!aiMove) {
            console.error('No available moves for AI - game should be over')
            // This should never happen unless board is full
            setGameState({
              ...updatedGameState,
              winner: ' ',
              gameOver: true,
              message: "It's a tie!"
            })
            updateGameStats(' ')
            setIsThinking(false)
            setIsLoading(false)
            return
          }

          // GUARANTEED: Apply AI move to verified empty cell
          const finalBoard = newBoard.map((boardRow, rowIdx) => 
            boardRow.map((cell, colIdx) => {
              if (rowIdx === aiMove.row && colIdx === aiMove.col && cell === ' ') {
                return 'O'
              }
              return cell
            })
          )
          
          // Check AI win condition
          const aiWin = checkWinCondition(finalBoard, 'O')
          const finalDraw = finalBoard.every(row => row.every(cell => cell !== ' '))
          
          const finalGameState: GameState = {
            board: finalBoard,
            winner: aiWin ? 'O' : (finalDraw ? ' ' : ' '),
            gameOver: aiWin || finalDraw,
            message: aiWin ? 'AI wins! Try again.' : (finalDraw ? "It's a tie!" : 'Your turn!'),
            currentPlayer: 'X'
          }
          
          setGameState(finalGameState)
          
          if (finalGameState.gameOver) {
            updateGameStats(finalGameState.winner)
            // showNotification(finalGameState.message, finalGameState.winner === 'O' ? 'error' : 'success') - REMOVED POPUP
          } else {
            // showNotification('AI played. Your turn!', 'info') - REMOVED POPUP
          }
        } catch (error) {
          console.error('Error getting AI move:', error)
          
          // CRITICAL FALLBACK: Even on error, AI must make a move
          const fallbackMove = findAvailableSquare(newBoard)
          if (fallbackMove) {
            console.log('Using fallback move after error:', fallbackMove)
            const finalBoard = newBoard.map((boardRow, rowIdx) => 
              boardRow.map((cell, colIdx) => {
                if (rowIdx === fallbackMove.row && colIdx === fallbackMove.col && cell === ' ') {
                  return 'O'
                }
                return cell
              })
            )
            
            // Check win/draw conditions
            const aiWin = checkWinCondition(finalBoard, 'O')
            const finalDraw = finalBoard.every(row => row.every(cell => cell !== ' '))
            
            const finalGameState: GameState = {
              board: finalBoard,
              winner: aiWin ? 'O' : (finalDraw ? ' ' : ' '),
              gameOver: aiWin || finalDraw,
              message: aiWin ? 'AI wins! Try again.' : (finalDraw ? "It's a tie!" : 'Your turn!'),
              currentPlayer: 'X'
            }
            
            setGameState(finalGameState)
            
            if (finalGameState.gameOver) {
              updateGameStats(finalGameState.winner)
            }
          } else {
            // No moves available - must be tie
            setGameState({
              ...updatedGameState,
              winner: ' ',
              gameOver: true,
              message: "It's a tie!"
            })
            updateGameStats(' ')
          }
        } finally {
          setIsThinking(false)
          setIsLoading(false)
        }
      }, 500) // Reduced delay - no need to show "AI thinking"
      
    } catch (error) {
      console.error('Error making move:', error)
      // showNotification('Failed to make move.', 'error') - REMOVED POPUP
      // Revert to previous state on error
      setGameState(gameState)
      setIsLoading(false)
    }
  }

  // Helper function to check win condition
  const checkWinCondition = (board: string[][], player: string): boolean => {
    // Check rows
    for (let i = 0; i < 3; i++) {
      if (board[i][0] === player && board[i][1] === player && board[i][2] === player) {
        return true
      }
    }
    
    // Check columns
    for (let i = 0; i < 3; i++) {
      if (board[0][i] === player && board[1][i] === player && board[2][i] === player) {
        return true
      }
    }
    
    // Check diagonals
    if (board[0][0] === player && board[1][1] === player && board[2][2] === player) {
      return true
    }
    if (board[0][2] === player && board[1][1] === player && board[2][0] === player) {
      return true
    }
    
    return false
  }

  // CRITICAL FALLBACK FUNCTION: Find any available square for AI
  const findAvailableSquare = (board: string[][]): { row: number, col: number } | null => {
    const availableSquares = []
    
    // Find all empty squares
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (board[row][col] === ' ') {
          availableSquares.push({ row, col })
        }
      }
    }
    
    if (availableSquares.length === 0) {
      return null // Board is full
    }
    
    // Return random available square as fallback
    const randomIndex = Math.floor(Math.random() * availableSquares.length)
    return availableSquares[randomIndex]
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
      return <span className="text-blue-600 font-bold text-lg select-none">✕</span>
    } else if (cell === 'O') {
      return <span className="text-red-600 font-bold text-lg select-none">⭕</span>
    }
    return null
  }

  const getCellClass = (row: number, col: number) => {
    const baseClass = "w-11 h-11 border-2 border-slate-400 flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors text-lg font-bold"
    
    if (gameState.board[row][col] !== ' ' || gameState.gameOver || isThinking || isLoading) {
      return baseClass + " cursor-not-allowed bg-slate-50"
    }
    
    return baseClass + " hover:bg-blue-100 bg-white"
  }

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50">
      {/* Widget Container */}
      <div className={`bg-white shadow-xl border border-blue-200 transition-all duration-300 overflow-hidden ${
        isMinimized ? 'w-14 h-14 rounded-full' : 'w-80 h-[420px]'
      }`}>
        
        {/* Minimized Blue Circle Icon State */}
        {isMinimized ? (
          <button
            onClick={toggleWidget}
            className="w-full h-full flex items-center justify-center hover:bg-blue-50 rounded-full transition-colors group"
            title="Play Tic-Tac-Toe"
          >
            <div className="bg-blue-100 p-2 rounded-full group-hover:bg-blue-200 transition-colors">
              <Grid3X3 className="h-6 w-6 text-blue-600" />
            </div>
          </button>
        ) : (
          <>
            {/* Widget Header - Expanded State */}
            <div className="flex items-center justify-between p-3 border-b border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 p-1.5 rounded-full">
                  <Grid3X3 className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-slate-900">Tic-Tac-Toe</span>
              </div>
              <button
                onClick={toggleWidget}
                className="p-1 hover:bg-white/50 rounded transition-colors"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            {/* Widget Content - Expanded State */}
            <div className="p-3 flex flex-col h-full">
              {/* Internal Notification System - REMOVED ALL POPUP NOTIFICATIONS */}
              {/* notification && (
                <div className={`mb-3 p-2 rounded text-xs flex items-center ${
                  notification.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
                  notification.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
                  'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                  {notification.type === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {notification.type === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
                  {notification.type === 'info' && <AlertCircle className="h-3 w-3 mr-1" />}
                  <span>{notification.message}</span>
                </div>
              ) */}
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-1 mb-2 text-xs flex-shrink-0">
                <div className="bg-blue-50 p-1 text-center">
                  <div className="font-bold text-blue-600 text-xs">{gameStats.wins}</div>
                  <div className="text-blue-500 text-xs">Wins</div>
                </div>
                <div className="bg-red-50 p-1 text-center">
                  <div className="font-bold text-red-600 text-xs">{gameStats.losses}</div>
                  <div className="text-red-500 text-xs">Losses</div>
                </div>
                <div className="bg-purple-50 p-1 text-center">
                  <div className="font-bold text-purple-600 text-xs">{gameStats.ties}</div>
                  <div className="text-purple-500 text-xs">Ties</div>
                </div>
              </div>

              {/* Players */}
              <div className="flex items-center justify-between mb-2 text-xs flex-shrink-0">
                <div className="flex items-center">
                  <User className="h-3 w-3 text-blue-600 mr-1" />
                  <span className="text-slate-700">You (X)</span>
                </div>
                <div className="flex items-center">
                  <Brain className={`h-3 w-3 text-red-600 mr-1 ${isThinking ? 'animate-pulse' : ''}`} />
                  <span className="text-slate-700">AI (O)</span>
                </div>
              </div>

              {/* Game Status - NO AI MESSAGES */}
              <div className="text-center mb-2 flex-shrink-0">
                <div className="text-xs text-slate-600 p-1 bg-slate-50">
                  {gameState.message}
                </div>
              </div>

              {/* Game Board - PROPERLY CONTAINED SQUARE */}
              <div className="flex justify-center mb-3 flex-1 items-center">
                <div className="grid grid-cols-3 gap-1 bg-slate-200 p-2 w-40 h-40">
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

              {/* Loading Indicator - REMOVED AI STATUS MESSAGES */}
              {/* (isLoading || isThinking) && (
                <div className="text-center mb-2 flex-shrink-0">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mx-auto mb-1"></div>
                  <p className="text-xs text-slate-500">
                    {isThinking ? 'AI calculating...' : 'Processing...'}
                  </p>
                </div>
              ) */}

              {/* Control Buttons */}
              <div className="flex space-x-2 flex-shrink-0 mb-2">
                <button
                  onClick={startNewGame}
                  disabled={isLoading || isThinking}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  New Game
                </button>
              </div>

              {/* Footer */}
              <div className="mt-2 pt-2 border-t border-slate-200 flex-shrink-0">
                <div className="text-center">
                  <div className="text-xs text-slate-500 flex items-center justify-center">
                    <Brain className="h-3 w-3 mr-1" />
                    <span>Minimax AI</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
