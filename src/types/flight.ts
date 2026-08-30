import { z } from "zod";

export const FlightStatusSchema = z.enum([
    "scheduled", "on-time", "delayed", "boarding", "en-route", "landed", "cancelled"
]);

export const AirportInfoSchema = z.object({
    code: z.string(),
    city: z.string(),
    time: z.string(),
    terminal: z.string().optional(),
    gate: z.string().optional()
});

export const TelemetrySchema = z.object({
    altitude: z.number(),
    speed: z.number(),
    heading: z.number(),
    etaMinutes: z.number().int(),
    lastUpdated: z.string()
});

export const FlightEventSchema = z.object({
    time: z.string(),
    label: z.string()
});

export const FlightDataSchema = z.object({
    flightNumber: z.string(),
    callsign: z.string(),
    icao24: z.string().optional(),
    airline: z.string(),
    status: FlightStatusSchema,
    departure: AirportInfoSchema,
    arrival: AirportInfoSchema,
    duration: z.string(),
    aircraft: z.string(),
    progress: z.number().int(),
    delay: z.string().optional(),
    date: z.string(),
    telemetry: TelemetrySchema.nullable(),
    events: FlightEventSchema.array()
});

export type FlightStatus = z.infer<typeof FlightStatusSchema>;
export type AirportInfo = z.infer<typeof AirportInfoSchema>;
export type Telemetry = z.infer<typeof TelemetrySchema>;
export type FlightEvent = z.infer<typeof FlightEventSchema>;
export type FlightData = z.infer<typeof FlightDataSchema>;

