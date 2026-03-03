import { client } from '@/api/client'
import type { LoginResponse } from '@/api/types/auth'

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await client.post<LoginResponse>('/auth', { email, password })
  return response.data
}
