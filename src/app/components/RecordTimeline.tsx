"use client";

import { useEffect, useRef } from "react";
import type { WeatherIconName } from "../../icons";
import { TimelineRecordCard } from "./TimelineRecordCard";

export interface RecordTimelineItem {
  id: string;
  date: { yyyy: string; mm: string; dd: string };
  timeLabel: string;
  body: string;
  weatherIcon?: WeatherIconName | null;
}

export interface RecordTimelineProps {
  /** 오래된 기록 → 최신 기록 순 (왼쪽 → 오른쪽) */
  items: RecordTimelineItem[];
  /** 맨 오른쪽 "새 기록" 카드에 표시할 오늘 날짜·시각 (마운트 후 채움) */
  now: { date: { yyyy: string; mm: string; dd: string }; timeLabel: string } | null;
  nowWeatherIcon?: WeatherIconName | null;
  /** 이 id의 카드를 가운데로 이동시킴 (방금 저장한 기록). 없으면 "새 기록" 카드가 가운데 */
  focusId?: string | null;
  onWrite: () => void;
}

/** 카드 사이 연결선 — Figma `line` (54.5px) */
function Connector() {
  return (
    <div
      aria-hidden
      className="h-px w-[54.5px] shrink-0 bg-[color:var(--colorBlackOpacity10,rgba(0,0,0,0.1))]"
      data-name="line"
    />
  );
}

function centerInContainer(container: HTMLElement, target: HTMLElement, behavior: ScrollBehavior) {
  const left = target.offsetLeft - (container.clientWidth - target.clientWidth) / 2;
  container.scrollTo({ left: Math.max(0, left), behavior });
}

/** 마우스로 이만큼(px) 이상 끌면 "드래그"로 보고, 놓을 때 생기는 클릭은 무시한다 */
const DRAG_THRESHOLD_PX = 5;

/**
 * Figma `타임라인뷰`(590:7998)·`cards`(1513:13880) — 가로로 긴 카드 띠 + 맨 끝 "새 기록" 카드.
 * 한 장씩 넘기는 스와이프/스냅이 아니라 **자유 스크롤**이다 — 손가락(터치)은 브라우저 기본
 * 스크롤(관성 포함), 마우스는 끌기·휠로 예전 기록까지 쭉 훑어볼 수 있다.
 */
export function RecordTimeline({
  items,
  now,
  nowWeatherIcon,
  focusId,
  onWrite,
}: RecordTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const newCardRef = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startLeft: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  // 마우스 휠(세로)을 가로 스크롤로 바꿔 준다 — 이 화면은 세로로 스크롤할 일이 없다.
  // preventDefault가 필요해서 React onWheel(passive) 대신 직접 등록한다.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      scroller.scrollLeft += e.deltaY;
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, []);

  // 마우스로 끌어 스크롤. 터치는 브라우저 기본 스크롤을 쓰므로 건드리지 않는다.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false; // 이전 드래그의 클릭 무시 표시가 남아 있지 않게
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startLeft: e.currentTarget.scrollLeft,
      dragging: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (!drag.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      // 카드 밖으로 나가도 끌기가 이어지게 한다. 지원 안 하는 환경이면 그냥 넘어간다.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 포인터 캡처 없이도 동작 */
      }
    }
    e.currentTarget.scrollLeft = drag.startLeft - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.dragging) {
      suppressClickRef.current = true;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* 캡처가 없었으면 무시 */
      }
    }
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    const newCard = newCardRef.current;
    if (!scroller || !newCard) return;
    // 먼저 "새 기록" 카드를 가운데에 두고, 방금 저장한 기록이 있으면 그 카드로 부드럽게 이동
    centerInContainer(scroller, newCard, "auto");
    const focusEl = focusRef.current;
    if (focusEl) {
      const raf = requestAnimationFrame(() => centerInContainer(scroller, focusEl, "smooth"));
      return () => cancelAnimationFrame(raf);
    }
  }, [focusId, items.length]);

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar relative w-full cursor-grab select-none overflow-x-auto overflow-y-hidden overscroll-x-contain py-6 active:cursor-grabbing"
      data-name="cards"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // 끌고 난 뒤 손을 뗄 때 카드에 클릭이 전달되지 않도록 캡처 단계에서 막는다
      onClickCapture={(e) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      <ul className="flex w-max items-center pl-[calc(50%-174.5px)] pr-[calc(50%-120px)]">
        {items.map((item) => (
          <li key={item.id} className="flex items-center">
            <Connector />
            <div ref={item.id === focusId ? focusRef : undefined}>
              <TimelineRecordCard
                date={item.date}
                timeLabel={item.timeLabel}
                weatherIcon={item.weatherIcon}
                body={item.body}
              />
            </div>
          </li>
        ))}
        <li className="flex items-center">
          <Connector />
          <button
            ref={newCardRef}
            type="button"
            onClick={onWrite}
            aria-label="새 기록 쓰기"
            className="cursor-pointer rounded-[var(--Grid-Radius-XL,16px)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--colorOutlinePrimaryDefault,#03584d)]"
          >
            <TimelineRecordCard
              date={now?.date ?? { yyyy: "", mm: "", dd: "" }}
              timeLabel={now?.timeLabel ?? ""}
              weatherIcon={nowWeatherIcon}
              placeholder="바로 지금, 어떤 생각이 떠올랐나요?"
            />
          </button>
        </li>
      </ul>
    </div>
  );
}
