// The app frame: renders the view built by src/view/index.js (bars, screen content, sticky button, tabs, toast, sheet).
import { TopBar, QuizBar, Sticky, Nav, Sheet } from './Chrome.jsx';
import { Home, TestHero, ProgHero, Profile } from './Dashboard.jsx';
import { Fiche, Flash, QuestionView, Result } from './Study.jsx';
import { Chips, Group, Empty } from './Lists.jsx';
import { ProposeForm } from './ProposeForm.jsx';

export function Toast({ t }) {
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: t.bottom, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div role="status" aria-live="polite" style={{ background: 'var(--toast)', color: 'var(--onToast)', padding: '12px 18px', borderRadius: 10, fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,.22)', animation: 'tcRise .2s ease' }}>{t.icon}{t.m}</div>
    </div>
  );
}

// Scrollable content of the current screen, in a fixed order.
export function Content({ v, cardRef }) {
  return (
    <>
      {v.largeTitle && <h1 style={{ margin: 0, padding: '6px 20px 0', font: '600 32px/1.1 var(--font-heading)', letterSpacing: '-.01em' }}>{v.largeTitle}</h1>}
      {v.home && <Home h={v.home} />}
      {v.testHero && <TestHero t={v.testHero} />}
      {v.progHero && <ProgHero p={v.progHero} />}
      {v.profile && <Profile p={v.profile} />}
      {v.intro && <p style={{ margin: 0, padding: '8px 20px 0', fontSize: 16, lineHeight: 1.5, color: 'var(--text2)', textWrap: 'pretty' }}>{v.intro}</p>}
      {v.fiche && <Fiche f={v.fiche} />}
      {v.flash && <Flash f={v.flash} cardRef={cardRef} />}
      {v.qv && <QuestionView qv={v.qv} />}
      {v.propose && <ProposeForm f={v.propose} />}
      {v.res && <Result r={v.res} />}
      {v.chips && <Chips chips={v.chips} />}
      {v.groups.map((g, gi) => <Group key={gi} g={g} />)}
      {v.empty && <Empty e={v.empty} />}
    </>
  );
}

export function Screen({ v, scrollRef, contentRef, cardRef, sheetHandlers }) {
  return (
    <div className="app">
      <div className="safe-top" />
      {v.bar.show && <TopBar bar={v.bar} />}
      {v.quizBar && <QuizBar b={v.quizBar} />}
      <div ref={scrollRef} className="scroller">
        <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 28 }}>
          <Content v={v} cardRef={cardRef} />
        </div>
      </div>
      {v.sticky && <Sticky s={v.sticky} />}
      {v.showNav && <Nav tabs={v.tabs} />}
      <div className="safe-bottom" style={{ background: v.safeBg }} />
      {v.toast && <Toast t={v.toast} />}
      {v.sheet && <Sheet sheet={v.sheet} {...sheetHandlers} />}
    </div>
  );
}
