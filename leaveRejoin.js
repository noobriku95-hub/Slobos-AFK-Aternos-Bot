function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

function setupLeaveRejoin(bot, createBot, authPassword = 'Z7m!qP3#vL8@tX2$kR9') {
    let leaveTimer = null
    let jumpTimer = null
    let jumpOffTimer = null
    let reconnectTimer = null
    let authTimer = null

    let stopped = false
    let reconnectAttempts = 0
    let lastLogAt = 0
    let authDone = false
    let authTrying = false

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now()
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now
            console.log(msg)
        }
    }

    function clearTimers() {
        if (leaveTimer) clearTimeout(leaveTimer)
        if (jumpTimer) clearTimeout(jumpTimer)
        if (jumpOffTimer) clearTimeout(jumpOffTimer)
        if (reconnectTimer) clearTimeout(reconnectTimer)
        if (authTimer) clearTimeout(authTimer)
        leaveTimer = jumpTimer = jumpOffTimer = reconnectTimer = authTimer = null
    }

    function stopAll() {
        stopped = true
        clearTimers()
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return

        bot.setControlState('jump', true)
        jumpOffTimer = setTimeout(() => {
            if (!stopped && bot.entity) bot.setControlState('jump', false)
        }, 300)

        const nextJump = randomMs(20000, 5 * 60 * 1000)
        jumpTimer = setTimeout(scheduleNextJump, nextJump)
    }

    function tryAuth() {
        if (stopped || authDone || authTrying) return
        if (!bot || !bot.chat) return

        authTrying = true

        authTimer = setTimeout(() => {
            if (stopped || authDone) return
            try {
                bot.chat(`/register ${authPassword} ${authPassword}`)
            } catch {}
        }, 1200)

        authTimer = setTimeout(() => {
            if (stopped || authDone) return
            try {
                bot.chat(`/login ${authPassword}`)
            } catch {}
            authTrying = false
        }, 3000)
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return

        let delay = randomMs(2000, 10000)
        reconnectAttempts++
        if (reconnectAttempts > 3) delay += 5000
        delay = Math.min(delay, 15000)

        logThrottled(`[AFK] Rejoin scheduled in ${Math.round(delay / 1000)}s (reason: ${reason}, attempt: ${reconnectAttempts})`)

        reconnectTimer = setTimeout(() => {
            if (stopped) return
            try {
                if (typeof createBot === 'function') createBot()
            } catch (e) {
                console.log('[AFK] createBot error:', e?.message || e)
                scheduleReconnect('createBot-error')
            }
        }, delay)
    }

    bot.on('message', (msg) => {
        const text = msg.toString().toLowerCase()

        if (text.includes('/register') || text.includes('register') || text.includes('/reg')) {
            if (!authDone) {
                setTimeout(() => {
                    if (stopped) return
                    try {
                        bot.chat(`/register ${authPassword} ${authPassword}`)
                    } catch {}
                }, 800)
            }
        }

        if (text.includes('/login') || text.includes('login')) {
            if (!authDone) {
                setTimeout(() => {
                    if (stopped) return
                    try {
                        bot.chat(`/login ${authPassword}`)
                    } catch {}
                }, 800)
            }
        }

        if (
            text.includes('you are now logged in') ||
            text.includes('logged in successfully') ||
            text.includes('authenticated') ||
            text.includes('authentication successful') ||
            text.includes('enregistr') ||
            text.includes('connecté')
        ) {
            authDone = true
            authTrying = false
            logThrottled('[Auth] Bot authenticated')
        }
    })

    bot.once('spawn', () => {
        reconnectAttempts = 0
        clearTimers()
        stopped = false
        authDone = false
        authTrying = false

        setTimeout(() => {
            tryAuth()
        }, 1000)

        const stayTime = randomMs(60000, 300000)
        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)} seconds`)

        scheduleNextJump()

        leaveTimer = setTimeout(() => {
            if (stopped) return
            logThrottled('[AFK] Leaving server (timer)')
            stopAll()
            try {
                bot.quit()
            } catch {}
        }, stayTime)
    })

    bot.on('end', () => {
        stopAll()
        scheduleReconnect('end')
    })

    bot.on('kicked', () => {
        stopAll()
        scheduleReconnect('kicked')
    })

    bot.on('error', (err) => {
        console.log('[AFK] bot error:', err?.message || err)
        stopAll()
        scheduleReconnect('error')
    })
}

module.exports = setupLeaveRejoin
