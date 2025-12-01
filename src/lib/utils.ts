import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// date/time formatting utilities using Intl

const dateShort = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

const dateLong = new Intl.DateTimeFormat("en-US", {
	weekday: "long",
	month: "long",
	day: "numeric",
	year: "numeric",
});

const timeShort = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
});

const timeLong = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
	second: "2-digit",
	timeZoneName: "short",
});

const dateTimeShort = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

const dateTimeLong = new Intl.DateTimeFormat("en-US", {
	weekday: "long",
	month: "long",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
	timeZoneName: "short",
});

const relativeTime = new Intl.RelativeTimeFormat("en-US", {
	numeric: "auto",
	style: "long",
});

const relativeTimeShort = new Intl.RelativeTimeFormat("en-US", {
	numeric: "auto",
	style: "short",
});

type DateInput = Date | number | string;

function toDate(input: DateInput): Date {
	return input instanceof Date ? input : new Date(input);
}

// absolute date formatting
export function formatDateShort(date: DateInput): string {
	return dateShort.format(toDate(date));
}

export function formatDateLong(date: DateInput): string {
	return dateLong.format(toDate(date));
}

// absolute time formatting
export function formatTimeShort(date: DateInput): string {
	return timeShort.format(toDate(date));
}

export function formatTimeLong(date: DateInput): string {
	return timeLong.format(toDate(date));
}

// absolute datetime formatting
export function formatDateTimeShort(date: DateInput): string {
	return dateTimeShort.format(toDate(date));
}

export function formatDateTimeLong(date: DateInput): string {
	return dateTimeLong.format(toDate(date));
}

// relative time formatting - picks appropriate unit automatically
export function formatRelativeTime(
	date: DateInput,
	style: "long" | "short" = "long",
): string {
	const d = toDate(date);
	const now = Date.now();
	const diffMs = d.getTime() - now;
	const diffSec = Math.round(diffMs / 1000);
	const diffMin = Math.round(diffSec / 60);
	const diffHour = Math.round(diffMin / 60);
	const diffDay = Math.round(diffHour / 24);
	const diffWeek = Math.round(diffDay / 7);
	const diffMonth = Math.round(diffDay / 30);
	const diffYear = Math.round(diffDay / 365);

	const formatter = style === "short" ? relativeTimeShort : relativeTime;

	// pick the most appropriate unit
	if (Math.abs(diffSec) < 60) {
		return formatter.format(diffSec, "second");
	}
	if (Math.abs(diffMin) < 60) {
		return formatter.format(diffMin, "minute");
	}
	if (Math.abs(diffHour) < 24) {
		return formatter.format(diffHour, "hour");
	}
	if (Math.abs(diffDay) < 7) {
		return formatter.format(diffDay, "day");
	}
	if (Math.abs(diffWeek) < 4) {
		return formatter.format(diffWeek, "week");
	}
	if (Math.abs(diffMonth) < 12) {
		return formatter.format(diffMonth, "month");
	}
	return formatter.format(diffYear, "year");
}

// smart formatter: relative for recent, absolute for older
export function formatSmartDate(
	date: DateInput,
	thresholdDays = 7,
): string {
	const d = toDate(date);
	const now = Date.now();
	const diffMs = Math.abs(d.getTime() - now);
	const diffDays = diffMs / (1000 * 60 * 60 * 24);

	if (diffDays < thresholdDays) {
		return formatRelativeTime(date);
	}
	return formatDateShort(date);
}
