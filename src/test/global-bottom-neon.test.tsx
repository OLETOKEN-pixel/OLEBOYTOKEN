import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GlobalBottomNeon } from '@/components/layout/GlobalBottomNeon';

function renderNeonAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="*" element={<GlobalBottomNeon />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GlobalBottomNeon', () => {
  it('keeps rendering the fixed neon on the standalone shop route', () => {
    const { container } = renderNeonAt('/shop');

    expect(container.querySelector('[data-global-neon="true"]')).not.toBeNull();
  });

  it('does not render the fixed neon on standalone match detail routes', () => {
    const { container } = renderNeonAt('/matches/abc123');

    expect(container.querySelector('[data-global-neon="true"]')).toBeNull();
  });
});
