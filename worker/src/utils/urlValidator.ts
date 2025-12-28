/**
 * URL Security Validator
 * 
 * Prevents SSRF (Server-Side Request Forgery) attacks by blocking:
 * - Localhost URLs (127.0.0.1, localhost, ::1)
 * - Private IP ranges (RFC1918: 10.x, 172.16-31.x, 192.168.x)
 * - Cloud metadata endpoints (169.254.169.254)
 * - Link-local addresses
 * - Non-HTTP(S) protocols
 */

export interface UrlValidationResult {
  safe: boolean
  reason?: string
}

/**
 * Validates if a URL is safe to navigate to from the server
 * @param url - The URL to validate
 * @returns Validation result with safe flag and optional reason
 */
export function isUrlSafe(url: string): UrlValidationResult {
  try {
    const parsed = new URL(url)
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        safe: false,
        reason: `Protocol '${parsed.protocol}' is not allowed. Only HTTP and HTTPS are supported.`
      }
    }
    
    // Block localhost variants (IPv4 and IPv6)
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]',
      '::1',
      '[0:0:0:0:0:0:0:1]',
      '0:0:0:0:0:0:0:1'
    ]
    
    const hostname = parsed.hostname.toLowerCase()
    if (localhostPatterns.some(pattern => hostname === pattern || hostname.includes(pattern))) {
      return {
        safe: false,
        reason: 'Localhost URLs are blocked for security. Use ngrok or Cloudflare Tunnel to expose local apps.'
      }
    }
    
    // Block AWS/GCP/Azure metadata endpoints (cloud credential theft)
    const metadataEndpoints = [
      '169.254.169.254', // AWS, Azure, GCP
      '169.254.170.2',   // AWS ECS
      'metadata.google.internal', // GCP
      '100.100.100.200'  // Alibaba Cloud
    ]
    
    if (metadataEndpoints.some(endpoint => hostname === endpoint || hostname.includes(endpoint))) {
      return {
        safe: false,
        reason: 'Cloud metadata endpoints are blocked for security.'
      }
    }
    
    // Check for private IPv4 addresses (RFC1918 + link-local)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const ipv4Match = hostname.match(ipv4Regex)
    
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map(Number)
      const [a, b, c, d] = octets
      
      // Validate octets are in valid range
      if (octets.some(octet => octet < 0 || octet > 255)) {
        return {
          safe: false,
          reason: 'Invalid IP address format.'
        }
      }
      
      // Block private IP ranges
      if (
        a === 10 || // 10.0.0.0/8 (Class A private)
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (Class B private)
        (a === 192 && b === 168) || // 192.168.0.0/16 (Class C private)
        (a === 169 && b === 254) || // 169.254.0.0/16 (Link-local)
        a === 127 || // 127.0.0.0/8 (Loopback)
        a === 0 || // 0.0.0.0/8 (Current network)
        a === 255 || // 255.255.255.255 (Broadcast)
        (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (Shared address space)
        (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 (IETF Protocol Assignments)
        (a === 192 && b === 0 && c === 2) || // 192.0.2.0/24 (TEST-NET-1)
        (a === 198 && b === 51 && c === 100) || // 198.51.100.0/24 (TEST-NET-2)
        (a === 203 && b === 0 && c === 113) || // 203.0.113.0/24 (TEST-NET-3)
        (a >= 224) // 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved)
      ) {
        return {
          safe: false,
          reason: `Private IP address ${hostname} is blocked for security. Use a public URL or tunneling service.`
        }
      }
    }
    
    // Block private IPv6 addresses
    if (hostname.includes(':')) {
      const ipv6Lower = hostname.toLowerCase().replace(/[\[\]]/g, '')
      
      // Block IPv6 localhost
      if (ipv6Lower === '::1' || ipv6Lower === '0:0:0:0:0:0:0:1') {
        return {
          safe: false,
          reason: 'IPv6 localhost is blocked for security.'
        }
      }
      
      // Block IPv6 private ranges (fc00::/7 and fe80::/10)
      if (ipv6Lower.startsWith('fc') || ipv6Lower.startsWith('fd') || ipv6Lower.startsWith('fe8') || ipv6Lower.startsWith('fe9') || ipv6Lower.startsWith('fea') || ipv6Lower.startsWith('feb')) {
        return {
          safe: false,
          reason: 'Private IPv6 addresses are blocked for security.'
        }
      }
    }
    
    // Block common internal hostnames
    const internalHostnames = [
      'internal',
      'corp',
      'intranet',
      'local',
      'lan',
      'private'
    ]
    
    if (internalHostnames.some(pattern => hostname.includes(pattern) && !hostname.includes('.'))) {
      return {
        safe: false,
        reason: `Internal hostname '${hostname}' is blocked for security.`
      }
    }
    
    return { safe: true }
  } catch (error: any) {
    return {
      safe: false,
      reason: `Invalid URL format: ${error.message}`
    }
  }
}

/**
 * Validates a URL and throws an error if it's not safe
 * @param url - The URL to validate
 * @throws Error if URL is not safe
 */
export function validateUrlOrThrow(url: string): void {
  const result = isUrlSafe(url)
  if (!result.safe) {
    throw new Error(`URL validation failed: ${result.reason}`)
  }
}

