<?php

namespace Tests;

use App\Services\WordPressPublishingService;
use PHPUnit\Framework\TestCase;

class EmojiFilterTest extends TestCase
{
    public function testStripEmojisRemovesEmojisWhilePreservingStandardContent(): void
    {
        $service = new WordPressPublishingService();

        $input = "🎉 Grand Alumni Homecoming! 🎓 Join us this Saturday at JMCFI Gym! 👏🏆✨\n\nVisit: https://jmcfi.edu.ph 🔥";
        $cleaned = $service->stripEmojis($input);

        $this->assertStringNotContainsString('🎉', $cleaned);
        $this->assertStringNotContainsString('🎓', $cleaned);
        $this->assertStringNotContainsString('👏', $cleaned);
        $this->assertStringNotContainsString('🏆', $cleaned);
        $this->assertStringNotContainsString('✨', $cleaned);
        $this->assertStringNotContainsString('🔥', $cleaned);
        $this->assertStringContainsString('Grand Alumni Homecoming!', $cleaned);
        $this->assertStringContainsString('Join us this Saturday at JMCFI Gym!', $cleaned);
        $this->assertStringContainsString('Visit: https://jmcfi.edu.ph', $cleaned);
    }

    public function testStripEmojisHandlesNullAndEmptyString(): void
    {
        $service = new WordPressPublishingService();

        $this->assertSame('', $service->stripEmojis(null));
        $this->assertSame('', $service->stripEmojis(''));
    }

    public function testStripEmojisPreservesSpecialAccentsAndPunctuation(): void
    {
        $service = new WordPressPublishingService();

        $input = "Felicidades a José Niño y Señorita Peña! 🌟 (Event: 2026)";
        $cleaned = $service->stripEmojis($input);

        $this->assertSame('Felicidades a José Niño y Señorita Peña! (Event: 2026)', $cleaned);
    }
}
