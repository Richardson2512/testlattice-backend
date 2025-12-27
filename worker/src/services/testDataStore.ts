/**
 * Test Data Store
 * Maintains stateful test data across multi-page tests
 * Phase 3 Enhancement: Supports user bundles for sequential @fake patterns
 */

export interface UserBundle {
  email: string
  name: string
  username: string
  password?: string
  phone?: string
}

export class TestDataStore {
  private data: Map<string, string> = new Map()
  private userBundles: Map<string, UserBundle> = new Map() // Phase 3: User bundles
  private runId: string

  constructor(runId: string) {
    this.runId = runId
  }

  /**
   * Generate or retrieve test data for a given key
   * If key exists, returns stored value; otherwise generates and stores
   */
  generateOrRetrieve(key: string, generator: () => string): string {
    const fullKey = `${this.runId}_${key}`
    
    if (this.data.has(fullKey)) {
      return this.data.get(fullKey)!
    }
    
    const value = generator()
    this.data.set(fullKey, value)
    return value
  }

  /**
   * Set test data explicitly
   */
  set(key: string, value: string): void {
    const fullKey = `${this.runId}_${key}`
    this.data.set(fullKey, value)
  }

  /**
   * Get test data if exists
   */
  get(key: string): string | undefined {
    const fullKey = `${this.runId}_${key}`
    return this.data.get(fullKey)
  }

  /**
   * Check if test data exists for key
   */
  has(key: string): boolean {
    const fullKey = `${this.runId}_${key}`
    return this.data.has(fullKey)
  }

  /**
   * Clear all test data for this run
   */
  clear(): void {
    const keysToDelete: string[] = []
    this.data.forEach((_, key) => {
      if (key.startsWith(`${this.runId}_`)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.data.delete(key))
  }

  /**
   * Get all test data for this run
   */
  getAll(): Record<string, string> {
    const result: Record<string, string> = {}
    this.data.forEach((value, key) => {
      if (key.startsWith(`${this.runId}_`)) {
        const shortKey = key.replace(`${this.runId}_`, '')
        result[shortKey] = value
      }
    })
    return result
  }

  /**
   * Phase 3: Generate or retrieve user bundle (e.g., user_1, user_2)
   */
  generateOrRetrieveUserBundle(index: number): UserBundle {
    const key = `user_${index}`
    const fullKey = `${this.runId}_${key}`
    
    if (this.userBundles.has(fullKey)) {
      return this.userBundles.get(fullKey)!
    }
    
    const timestamp = Date.now()
    const bundle: UserBundle = {
      email: `user${index}_${timestamp}@Rihario.com`,
      name: `User ${index}`,
      username: `user_${index}_${timestamp}`,
      password: 'SecurePass123!',
      phone: `+1${2000000000 + index}`, // Unique phone per user
    }
    
    this.userBundles.set(fullKey, bundle)
    
    // Also store individual fields for easy access
    this.set(`${key}_email`, bundle.email)
    this.set(`${key}_name`, bundle.name)
    this.set(`${key}_username`, bundle.username)
    if (bundle.password) this.set(`${key}_password`, bundle.password)
    if (bundle.phone) this.set(`${key}_phone`, bundle.phone)
    
    return bundle
  }

  /**
   * Phase 3: Get user bundle field (e.g., user_1.email)
   */
  getUserBundleField(userIndex: number, field: keyof UserBundle): string | undefined {
    const bundle = this.generateOrRetrieveUserBundle(userIndex)
    return bundle[field]
  }

  /**
   * Phase 3: Get all user bundles for this run
   */
  getAllUserBundles(): Record<string, UserBundle> {
    const result: Record<string, UserBundle> = {}
    this.userBundles.forEach((bundle, key) => {
      if (key.startsWith(`${this.runId}_user_`)) {
        const shortKey = key.replace(`${this.runId}_`, '')
        result[shortKey] = bundle
      }
    })
    return result
  }
}

