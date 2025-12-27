/**
 * Frontend URL Validator
 * 
 * Client-side validation to provide immediate feedback to users
 * Note: This is NOT a security boundary - backend validation is required
 */

export interface UrlValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates a URL for testing purposes
 * Blocks localhost, private IPs, and provides helpful error messages
 */
export function validateTestUrl(url: string): UrlValidationResult {
  // Check if URL is empty
  if (!url || url.trim() === '') {
    return {
      valid: false,
      error: 'URL is required'
    }
  }

  try {
    const parsed = new URL(url)

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        valid: false,
        error: `Only HTTP and HTTPS URLs are supported. Found: ${parsed.protocol}`
      }
    }

    const hostname = parsed.hostname.toLowerCase()

    // Block localhost variants
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]',
      '::1'
    ]

    if (localhostPatterns.some(pattern => hostname === pattern || hostname.includes(pattern))) {
      return {
        valid: false,
        error: 'Localhost URLs are not supported. To test local apps, use ngrok, Cloudflare Tunnel, or Localtunnel to expose your app to the internet.'
      }
    }

    // Block AWS/cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname.includes('metadata')) {
      return {
        valid: false,
        error: 'Cloud metadata endpoints are not allowed for security reasons.'
      }
    }

    // Check for private IPv4 addresses
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const ipv4Match = hostname.match(ipv4Regex)

    if (ipv4Match) {
      const [_, a, b, c, d] = ipv4Match.map(Number)

      // Validate octets
      if ([a, b, c, d].some(octet => octet < 0 || octet > 255)) {
        return {
          valid: false,
          error: 'Invalid IP address format.'
        }
      }

      // Block private IP ranges
      if (
        a === 10 || // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) || // 192.168.0.0/16
        (a === 169 && b === 254) || // 169.254.0.0/16 (link-local)
        a === 127 || // 127.0.0.0/8 (loopback)
        a === 0 // 0.0.0.0/8
      ) {
        return {
          valid: false,
          error: `Private IP address ${hostname} is not supported. Use a public URL or expose your local app with ngrok.`
        }
      }
    }

    // Block private IPv6
    if (hostname.includes(':')) {
      const ipv6Lower = hostname.replace(/[\[\]]/g, '').toLowerCase()

      if (ipv6Lower === '::1' || ipv6Lower === '0:0:0:0:0:0:0:1') {
        return {
          valid: false,
          error: 'IPv6 localhost is not supported. Use ngrok or a public URL.'
        }
      }

      // Block private IPv6 ranges (fc00::/7, fe80::/10)
      if (ipv6Lower.startsWith('fc') || ipv6Lower.startsWith('fd') ||
        ipv6Lower.startsWith('fe8') || ipv6Lower.startsWith('fe9') ||
        ipv6Lower.startsWith('fea') || ipv6Lower.startsWith('feb')) {
        return {
          valid: false,
          error: 'Private IPv6 addresses are not supported.'
        }
      }
    }

    // Block common internal hostnames
    const internalPatterns = ['internal', 'corp', 'intranet', '.local', '.lan']
    if (internalPatterns.some(pattern => hostname.includes(pattern) && !hostname.includes('.'))) {
      return {
        valid: false,
        error: `Internal hostname '${hostname}' is not supported. Use a public URL.`
      }
    }

    // Warn about common development ports (helpful but not blocking)
    const devPorts = ['3000', '3001', '4200', '5000', '8000', '8080', '8888']
    if (devPorts.includes(parsed.port) && !hostname.includes('ngrok') && !hostname.includes('tunnel')) {
      // This is just a warning - we'll allow it but suggest tunneling
      console.warn(`Port ${parsed.port} detected - this looks like a development server. Consider using ngrok if this is a local app.`)
    }

    return { valid: true }

  } catch (error: any) {
    return {
      valid: false,
      error: `Invalid URL format: ${error.message}`
    }
  }
}

/**
 * Get helpful tunneling instructions based on the error
 */
export function getTunnelingHelp(): string {
  return `
To test local applications:

1. **Using ngrok** (Recommended):
   - Install: npm install -g ngrok
   - Run: ngrok http 3000
   - Use the provided https URL (e.g., https://abc123.ngrok-free.app)

2. **Using Cloudflare Tunnel**:
   - Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
   - Run: cloudflared tunnel --url http://localhost:PORT
   - Use the provided trycloudflare.com URL

3. **Using Localtunnel**:
   - Install: npm install -g localtunnel
   - Run: lt --port 3000
   - Use the provided loca.lt URL
  `.trim()
}

