export interface UserData {
  access_token: string
  user: UserInformation
}

export interface UserInformation {
  email: string
  name: string | null
  id: string
}
