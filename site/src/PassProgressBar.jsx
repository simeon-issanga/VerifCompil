export default function PassProgressBar({ listeDiffs, currentPass, onPassClick, diffAvecChangements }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            width: '100%',
            height: '20px',
            padding: '0 8px',
        }}>
            {listeDiffs.map((diff, i) => {
                const estActuel = i === currentPass;
                return (
                    <div
                        key={i}
                        title={`Pass ${i + 1}`}
                        onClick={() => onPassClick(i)}
                        style={{
                            flex: 1,
                            height: estActuel ? '16px' : '8px',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            backgroundColor: estActuel
                                ? '#13982b'
                                : diffAvecChangements(diff)
                                    ? '#2200ff'
                                    : '#333',
                            transition: 'height 0.1s', //Et je découvre cette dinguerie que maintenant mdr, trop stylé
                        }}
                    />
                )
            })}
        </div>
    )
}