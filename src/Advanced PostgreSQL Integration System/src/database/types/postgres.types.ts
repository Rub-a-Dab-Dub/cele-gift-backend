import { Transform } from "class-transformer"
import { IsArray, IsObject } from "class-validator"

// PostgreSQL-specific type definitions
export type PostgresArray<T> = T[]
export type PostgresJSON = Record<string, any>
export type PostgresJSONB = Record<string, any>
export type PostgresHstore = Record<string, string>
export type PostgresUUID = string
export type PostgresInterval = string
export type PostgresPoint = { x: number; y: number }
export type PostgresCircle = { center: PostgresPoint; radius: number }
export type PostgresBox = { upperRight: PostgresPoint; lowerLeft: PostgresPoint }
export type PostgresPath = PostgresPoint[]
export type PostgresPolygon = PostgresPoint[]
export type PostgresLine = { a: number; b: number; c: number }
export type PostgresLseg = { start: PostgresPoint; end: PostgresPoint }
export type PostgresInet = string
export type PostgresCidr = string
export type PostgresMacaddr = string
export type PostgresBit = string
export type PostgresVarbit = string
export type PostgresTsquery = string
export type PostgresTsvector = string

// Custom transformers for PostgreSQL types
export const PostgresArrayTransformer = {
  to: (value: any[]): string => {
    if (!Array.isArray(value)) return null
    return `{${value.map((v) => (typeof v === "string" ? `"${v}"` : v)).join(",")}}`
  },
  from: (value: string): any[] => {
    if (!value) return []
    // Parse PostgreSQL array format
    const cleaned = value.replace(/[{}]/g, "")
    return cleaned.split(",").map((v) => {
      const trimmed = v.trim()
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1)
      }
      return isNaN(Number(trimmed)) ? trimmed : Number(trimmed)
    })
  },
}

export const PostgresJSONTransformer = {
  to: (value: any): string => {
    return value ? JSON.stringify(value) : null
  },
  from: (value: string): any => {
    try {
      return value ? JSON.parse(value) : null
    } catch {
      return value
    }
  },
}

export const PostgresHstoreTransformer = {
  to: (value: Record<string, string>): string => {
    if (!value || typeof value !== "object") return null
    return Object.entries(value)
      .map(([key, val]) => `"${key}"=>"${val}"`)
      .join(", ")
  },
  from: (value: string): Record<string, string> => {
    if (!value) return {}
    const result: Record<string, string> = {}
    const pairs = value.match(/"([^"]+)"=>"([^"]*)"/g) || []
    pairs.forEach((pair) => {
      const [, key, val] = pair.match(/"([^"]+)"=>"([^"]*)"/) || []
      if (key) result[key] = val || ""
    })
    return result
  },
}

export const PostgresPointTransformer = {
  to: (value: PostgresPoint): string => {
    return value ? `(${value.x},${value.y})` : null
  },
  from: (value: string): PostgresPoint => {
    if (!value) return null
    const match = value.match(/$$([^,]+),([^)]+)$$/)
    return match ? { x: Number.parseFloat(match[1]), y: Number.parseFloat(match[2]) } : null
  },
}

// Validation decorators for PostgreSQL types
export const IsPostgresArray = (validationOptions?: any) => {
  return (object: any, propertyName: string) => {
    IsArray(validationOptions)(object, propertyName)
    Transform(({ value }) => PostgresArrayTransformer.from(value))(object, propertyName)
  }
}

export const IsPostgresJSON = (validationOptions?: any) => {
  return (object: any, propertyName: string) => {
    IsObject(validationOptions)(object, propertyName)
    Transform(({ value }) => PostgresJSONTransformer.from(value))(object, propertyName)
  }
}
