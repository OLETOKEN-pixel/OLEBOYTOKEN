interface MatchesLiveCardProps {
  title: string;
  firstTo: string;
  platform: string;
  entryFee: string;
  prize: string;
  expiresIn: string;
  onAccept?: () => void;
}

export function MatchesLiveCard({
  title,
  firstTo,
  platform,
  entryFee,
  prize,
  expiresIn,
  onAccept,
}: MatchesLiveCardProps) {
  return (
    <article className="matches-live-card">
      <header className="matches-live-card__header">
        <h2 className="matches-live-card__title">{title}</h2>
        <img
          className="matches-live-card__divider"
          src="/figma-assets/matches-card-divider.svg"
          alt=""
          aria-hidden="true"
        />
      </header>

      <div className="matches-live-card__info-grid">
        <div className="matches-live-card__metric">
          <span className="matches-live-card__label">First to</span>
          <div className="matches-live-card__value-row matches-live-card__value-row--first-to">
            <img
              className="matches-live-card__triangles"
              src="/figma-assets/matches-first-to-triangles.svg"
              alt=""
              aria-hidden="true"
            />
            <span className="matches-live-card__value matches-live-card__value--large">{firstTo}</span>
          </div>
        </div>

        <div className="matches-live-card__metric matches-live-card__metric--platform">
          <span className="matches-live-card__label">Platform</span>
          <span className="matches-live-card__value matches-live-card__value--platform">{platform}</span>
        </div>

        <div className="matches-live-card__metric matches-live-card__metric--money">
          <div className="matches-live-card__money-labels">
            <span className="matches-live-card__label">Entry fee</span>
            <span className="matches-live-card__label">Prize</span>
          </div>

          <div className="matches-live-card__money-values">
            <div className="matches-live-card__value-row">
              <img
                className="matches-live-card__dot"
                src="/figma-assets/matches-entry-dot.svg"
                alt=""
                aria-hidden="true"
              />
              <span className="matches-live-card__value">{entryFee}</span>
            </div>

            <img
              className="matches-live-card__arrow"
              src="/figma-assets/figma-arrow-stroke.svg"
              alt=""
              aria-hidden="true"
            />

            <div className="matches-live-card__value-row">
              <img
                className="matches-live-card__prize-icon"
                src="/figma-assets/matches-prize-icon.svg"
                alt=""
                aria-hidden="true"
              />
              <span className="matches-live-card__value">{prize}</span>
            </div>
          </div>
        </div>

        <div className="matches-live-card__metric matches-live-card__metric--expires">
          <span className="matches-live-card__label">Expires in</span>
          <div className="matches-live-card__value-row">
            <img
              className="matches-live-card__dot"
              src="/figma-assets/matches-expiry-dot.svg"
              alt=""
              aria-hidden="true"
            />
            <span className="matches-live-card__value">{expiresIn}</span>
          </div>
        </div>
      </div>

      <button
        className="matches-live-card__accept"
        type="button"
        onClick={onAccept}
        disabled={!onAccept}
        aria-disabled={!onAccept}
      >
        Accept token
      </button>
    </article>
  );
}
