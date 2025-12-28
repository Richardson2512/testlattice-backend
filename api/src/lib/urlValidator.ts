/**
 * URL validation and sanitization for security
 * Prevents SSRF attacks and validates URLs before testing
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:']
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS metadata service
  'metadata.google.internal', // GCP metadata service
]

const BLOCKED_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' }, // Private network
  { start: '172.16.0.0', end: '172.31.255.255' }, // Private network
  { start: '192.168.0.0', end: '192.168.255.255' }, // Private network
  { start: '127.0.0.0', end: '127.255.255.255' }, // Loopback
]

export interface ValidationResult {
  valid: boolean
  error?: string
  sanitizedUrl?: string
}

/**
 * Validate and sanitize URL for testing
 * Security checks:
 * - Only HTTP/HTTPS protocols
 * - No localhost/internal IPs (SSRF protection)
 * - Valid URL format
 * - No dangerous characters
 */
export function validateTestUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  // Trim whitespace
  const trimmed = url.trim()
  if (!trimmed) {
    return { valid: false, error: 'URL cannot be empty' }
  }

  // Add protocol if missing
  let urlToValidate = trimmed
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    urlToValidate = `https://${trimmed}`
  }

  // Parse URL
  let parsed: URL
  try {
    parsed = new URL(urlToValidate)
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Check protocol
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' }
  }

  // Check for blocked hosts
  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.some(blocked => hostname.includes(blocked))) {
    return { valid: false, error: 'Localhost and internal URLs are not allowed for security reasons' }
  }

  // Check for private IP ranges (basic check)
  // Note: This is a simplified check. For production, use a proper IP range library
  const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const ipMatch = hostname.match(ipPattern)
  if (ipMatch) {
    const ipParts = ipMatch.slice(1, 5).map(Number)
    const ip = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3]
    
    // Check against blocked ranges
    for (const range of BLOCKED_IP_RANGES) {
      const startParts = range.start.split('.').map(Number)
      const endParts = range.end.split('.').map(Number)
      const startIp = (startParts[0] << 24) + (startParts[1] << 16) + (startParts[2] << 8) + startParts[3]
      const endIp = (endParts[0] << 24) + (endParts[1] << 16) + (endParts[2] << 8) + endParts[3]
      
      if (ip >= startIp && ip <= endIp) {
        return { valid: false, error: 'Private/internal IP addresses are not allowed' }
      }
    }
  }

  // Sanitize: remove fragments, ensure proper format
  const sanitized = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`
  
  return { valid: true, sanitizedUrl: sanitized }
}

/**
 * Generate guest session ID using fingerprinting
 * Privacy-friendly: Uses non-PII data to create consistent session
 */
export function generateGuestSessionId(request: any): string {
  const ip = getClientIp(request)
  const userAgent = request.headers['user-agent'] || ''
  const acceptLanguage = request.headers['accept-language'] || ''
  
  // Get timezone (non-PII, but helps with uniqueness)
  const timezone = request.headers['timezone'] || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  
  // Create fingerprint hash
  const fingerprint = `${ip}|${userAgent}|${acceptLanguage}|${timezone}`
  
  // Simple hash function
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return `guest_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`
}

/**
 * Get or create guest session from cookie
 */
export function getGuestSessionFromCookie(request: any): string | null {
  return request.cookies?.guest_session || null
}

/**
 * Set guest session cookie
 */
export function setGuestSessionCookie(reply: any, sessionId: string): void {
  reply.setCookie('guest_session', sessionId, {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  })
}

/**
 * Extract client IP from request
 */
export function getClientIp(request: any): string {
  // Check various headers (for proxies/load balancers)
  const forwarded = request.headers['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIp = request.headers['x-real-ip']
  if (realIp) {
    return realIp
  }
  
  // Fallback to socket remote address
  return request.socket?.remoteAddress || 'unknown'
}

