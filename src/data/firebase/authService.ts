import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { getFirebaseAuth } from "./config"
import type { DeviceRole } from "../../models"

const BRANCH_STORAGE_KEY = "smart-inventory-branch-id"
const STORE_CODE_STORAGE_KEY = "smart-inventory-store-code"
const DEFAULT_BRANCH_ID = "main_branch"

export type StoreAuthState = {
  user: User | null
  branchId: string
  storeCode: string
  isAuthenticated: boolean
}

export class StoreAuthService {
  private branchId: string = DEFAULT_BRANCH_ID
  private storeCode: string = ""
  private currentUser: User | null = null
  private authListeners = new Set<(state: StoreAuthState) => void>()

  constructor() {
    if (typeof window !== "undefined") {
      this.branchId =
        localStorage.getItem(BRANCH_STORAGE_KEY) || DEFAULT_BRANCH_ID
      this.storeCode = localStorage.getItem(STORE_CODE_STORAGE_KEY) || ""
    }

    try {
      const auth = getFirebaseAuth()
      onAuthStateChanged(auth, (user) => {
        this.currentUser = user
        this.notifyListeners()
      })
    } catch (error) {
      console.warn("Firebase Auth initialization skipped:", error)
    }
  }

  getBranchId(): string {
    return this.branchId
  }

  setBranchId(branchId: string) {
    this.branchId = branchId.trim() || DEFAULT_BRANCH_ID
    if (typeof window !== "undefined") {
      localStorage.setItem(BRANCH_STORAGE_KEY, this.branchId)
    }
    this.notifyListeners()
  }

  getStoreCode(): string {
    return this.storeCode
  }

  setStoreCode(code: string) {
    this.storeCode = code.trim().toUpperCase()
    if (typeof window !== "undefined") {
      localStorage.setItem(STORE_CODE_STORAGE_KEY, this.storeCode)
    }
    this.notifyListeners()
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  isStoreAuthenticated(): boolean {
    return this.currentUser !== null
  }

  getAuthState(): StoreAuthState {
    return {
      user: this.currentUser,
      branchId: this.branchId,
      storeCode: this.storeCode,
      isAuthenticated: this.isStoreAuthenticated(),
    }
  }

  subscribe(listener: (state: StoreAuthState) => void): () => void {
    this.authListeners.add(listener)
    listener(this.getAuthState())
    return () => {
      this.authListeners.delete(listener)
    }
  }

  private notifyListeners() {
    const state = this.getAuthState()
    this.authListeners.forEach((listener) => {
      try {
        listener(state)
      } catch (err) {
        console.error("Auth listener error:", err)
      }
    })
  }

  /**
   * Signs in with the Store Owner credentials.
   */
  async signInStore(email: string, password: string): Promise<User> {
    const auth = getFirebaseAuth()
    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    )
    this.currentUser = credential.user
    this.notifyListeners()
    return credential.user
  }

  /**
   * Registers a new Store Account.
   */
  async registerStore(email: string, password: string): Promise<User> {
    const auth = getFirebaseAuth()
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    )
    this.currentUser = credential.user
    this.notifyListeners()
    return credential.user
  }

  /**
   * Authenticates a branch device (Butcher or Restaurant tablet) seamlessly.
   * Can use anonymous auth or store-code device credential.
   */
  async ensureDeviceAuthenticated(): Promise<User> {
    const auth = getFirebaseAuth()
    if (auth.currentUser) {
      this.currentUser = auth.currentUser
      return auth.currentUser
    }
    // Authenticate anonymously so device gets a valid request.auth.uid for Firestore
    const credential = await signInAnonymously(auth)
    this.currentUser = credential.user
    this.notifyListeners()
    return credential.user
  }

  /**
   * Signs out from the current store account.
   */
  async signOutStore(): Promise<void> {
    const auth = getFirebaseAuth()
    await signOut(auth)
    this.currentUser = null
    this.notifyListeners()
  }
}

export const storeAuthService = new StoreAuthService()
