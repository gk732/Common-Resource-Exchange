Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const requestData = await req.json();
        const action = requestData.action;

        // Game constants - exact same as Java
        const HUMAN = 'X';
        const AI = 'O';
        const EMPTY = ' ';

        // Initialize empty board
        const initializeBoard = () => {
            const board = [];
            for (let i = 0; i < 3; i++) {
                board[i] = [];
                for (let j = 0; j < 3; j++) {
                    board[i][j] = EMPTY;
                }
            }
            return board;
        };

        // Check if move is valid - exact same as Java
        const isValidMove = (board, row, col) => {
            return row >= 0 && row < 3 && col >= 0 && col < 3 && board[row][col] === EMPTY;
        };

        // Check winner - exact same as Java
        const checkWinner = (board) => {
            // Check rows
            for (let i = 0; i < 3; i++) {
                if (board[i][0] === board[i][1] && board[i][1] === board[i][2] && board[i][0] !== EMPTY) {
                    return board[i][0];
                }
            }

            // Check columns
            for (let j = 0; j < 3; j++) {
                if (board[0][j] === board[1][j] && board[1][j] === board[2][j] && board[0][j] !== EMPTY) {
                    return board[0][j];
                }
            }

            // Check diagonals
            if (board[0][0] === board[1][1] && board[1][1] === board[2][2] && board[0][0] !== EMPTY) {
                return board[0][0];
            }

            if (board[0][2] === board[1][1] && board[1][1] === board[2][0] && board[0][2] !== EMPTY) {
                return board[0][2];
            }

            return EMPTY; // No winner
        };

        // Check if board is full - exact same as Java
        const isBoardFull = (board) => {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (board[i][j] === EMPTY) {
                        return false;
                    }
                }
            }
            return true;
        };

        // Check if game is over - exact same as Java
        const isGameOver = (board) => {
            return checkWinner(board) !== EMPTY || isBoardFull(board);
        };

        // Clone board for minimax - exact same as Java
        const cloneBoard = (board) => {
            const clone = [];
            for (let i = 0; i < 3; i++) {
                clone[i] = [...board[i]];
            }
            return clone;
        };

        // Minimax algorithm - exact same as Java
        const minimax = (board, depth, isMaximizing) => {
            const winner = checkWinner(board);

            if (winner === AI) return 10 - depth;
            if (winner === HUMAN) return depth - 10;
            if (isBoardFull(board)) return 0;

            if (isMaximizing) {
                let bestScore = Number.MIN_SAFE_INTEGER;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        if (board[i][j] === EMPTY) {
                            board[i][j] = AI;
                            const score = minimax(board, depth + 1, false);
                            board[i][j] = EMPTY;
                            bestScore = Math.max(score, bestScore);
                        }
                    }
                }
                return bestScore;
            } else {
                let bestScore = Number.MAX_SAFE_INTEGER;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        if (board[i][j] === EMPTY) {
                            board[i][j] = HUMAN;
                            const score = minimax(board, depth + 1, true);
                            board[i][j] = EMPTY;
                            bestScore = Math.min(score, bestScore);
                        }
                    }
                }
                return bestScore;
            }
        };

        // Get best AI move using minimax - exact same as Java
        const getBestMove = (board) => {
            let bestScore = Number.MIN_SAFE_INTEGER;
            let bestMove = { row: 0, col: 0 };

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (board[i][j] === EMPTY) {
                        board[i][j] = AI;
                        const score = minimax(board, 0, false);
                        board[i][j] = EMPTY;

                        if (score > bestScore) {
                            bestScore = score;
                            bestMove.row = i;
                            bestMove.col = j;
                        }
                    }
                }
            }

            return bestMove;
        };

        // Get game message
        const getGameMessage = (winner, gameOver) => {
            if (!gameOver) {
                return "Game in progress";
            }

            if (winner === HUMAN) {
                return "Congratulations! You won!";
            } else if (winner === AI) {
                return "AI wins! Better luck next time.";
            } else {
                return "It's a tie!";
            }
        };

        let result;

        switch (action) {
            case 'start':
                const newBoard = initializeBoard();
                result = {
                    board: newBoard,
                    winner: EMPTY,
                    gameOver: false,
                    message: "New game started",
                    currentPlayer: HUMAN
                };
                break;

            case 'move':
                const { board: currentBoard, row, col } = requestData;
                
                if (!currentBoard || row === undefined || col === undefined) {
                    throw new Error('Board, row, and col are required for move action');
                }

                if (!isValidMove(currentBoard, row, col)) {
                    result = {
                        board: currentBoard,
                        winner: EMPTY,
                        gameOver: false,
                        message: "Invalid move",
                        currentPlayer: HUMAN
                    };
                } else {
                    // Make human move
                    const newBoard = cloneBoard(currentBoard);
                    newBoard[row][col] = HUMAN;
                    
                    const winner = checkWinner(newBoard);
                    const gameOver = isGameOver(newBoard);
                    const message = getGameMessage(winner, gameOver);
                    
                    result = {
                        board: newBoard,
                        winner: winner,
                        gameOver: gameOver,
                        message: message,
                        currentPlayer: AI
                    };
                }
                break;

            case 'ai-move':
                const { board: gameBoard } = requestData;
                
                if (!gameBoard) {
                    throw new Error('Board is required for ai-move action');
                }

                if (isGameOver(gameBoard)) {
                    const winner = checkWinner(gameBoard);
                    result = {
                        row: -1,
                        col: -1,
                        board: gameBoard,
                        winner: winner,
                        gameOver: true,
                        message: getGameMessage(winner, true)
                    };
                } else {
                    // Get AI move using minimax
                    const bestMove = getBestMove(gameBoard);
                    
                    // Make AI move
                    const newBoard = cloneBoard(gameBoard);
                    newBoard[bestMove.row][bestMove.col] = AI;
                    
                    const winner = checkWinner(newBoard);
                    const gameOver = isGameOver(newBoard);
                    const message = getGameMessage(winner, gameOver);
                    
                    result = {
                        row: bestMove.row,
                        col: bestMove.col,
                        board: newBoard,
                        winner: winner,
                        gameOver: gameOver,
                        message: message
                    };
                }
                break;

            case 'status':
                const { board: statusBoard } = requestData;
                
                if (!statusBoard) {
                    throw new Error('Board is required for status action');
                }
                
                const winner = checkWinner(statusBoard);
                const gameOver = isGameOver(statusBoard);
                const message = getGameMessage(winner, gameOver);
                
                result = {
                    board: statusBoard,
                    winner: winner,
                    gameOver: gameOver,
                    message: message,
                    currentPlayer: HUMAN
                };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ 
            success: true,
            data: result,
            message: `Tic-tac-toe ${action} operation completed successfully`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Tic-tac-toe game error:', error);

        const errorResponse = {
            error: {
                code: 'TICTACTOE_GAME_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});